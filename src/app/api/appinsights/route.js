import https from "https";
import fetch from "node-fetch";

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        const d365foId =
            searchParams.get("d365foId") ||
            searchParams.get("d365foid") ||
            "";

        const route = searchParams.get("route") || "";
        const bucket = searchParams.get("bucket") || ""; // ✅ NEW
        const timespan = searchParams.get("timespan") || "P90D";

        if (!d365foId || (!route && !bucket)) {
            return Response.json(
                { error: "d365foId and route/bucket are required" },
                { status: 400 }
            );
        }

        const APP_ID = process.env.APP_ID;
        const API_KEY = process.env.API_KEY;
        if (!APP_ID || !API_KEY) {
            return Response.json(
                { error: "Missing environment variables" },
                { status: 500 }
            );
        }

        // =========================
        // ROUTE CONFIG
        // =========================
        const routeConfig = {
            "PRPA-PA": {
                type: "PRPA_PA",
                subType: "PRPA_PA_UPSERT",
                parser: "d365fo",
            },
            "PRPA-PR": {
                type: "PR_OUTBOUND",
                subType: "PRPA_PR_OUTBOUND",
                parser: "client",
            },
        };

        // =========================
        // BUCKET CONFIG ✅ NEW
        // =========================
        const bucketConfig = {
            PR: ["PRPA-PR", "PRPA-PA"], // add PRPA-PO later
        };

        // =========================
        // RESOLVE ROUTES ✅ NEW
        // =========================
        let routesToExecute = [];

        if (bucket) {
            routesToExecute = bucketConfig[bucket] || [];
        } else {
            routesToExecute = [route];
        }

        if (routesToExecute.length === 0) {
            return Response.json(
                { error: "No valid routes found" },
                { status: 400 }
            );
        }

        // =========================
        // PARSERS
        // =========================
        const parsers = {
            d365fo: `
let d365fo =
traces
| where operation_Id in (opIds)
| where message has "req_acceptance_flag"
| summarize arg_max(timestamp, *) by operation_Id
| extend log_str = tostring(message)
| extend response_json = extract(@"{.*}", 0, log_str)
| extend parsed = iif(isempty(response_json), dynamic(null), parse_json(response_json))
| extend d365fo_status = tostring(parsed.req_acceptance_flag) =~ "true"
| project operation_Id, d365fo_status, log_str;
`,

            client: `
let client =
traces
| where operation_Id in (opIds)
| where message has "req_acceptance_flag"
| summarize arg_max(timestamp, *) by operation_Id
| extend log_str = tostring(message)
| extend json_start = indexof(log_str, "{")
| extend json_part = substring(log_str, json_start)
| extend parsed = parse_json(json_part)
| extend
    req_flag = tolower(trim(" ", tostring(parsed.req_acceptance_flag))),
    req_error_msg = tostring(parsed.req_error_msg)
| extend
    client_status = iff(
        req_flag == "true" and
        (isempty(req_error_msg) or req_error_msg == "null"),
        true,
        false
    )
| project operation_Id, client_status, log_str;
`,
        };

        // =========================
        // EXECUTE PER ROUTE ✅ NEW LOOP
        // =========================
        let finalResults = [];

        for (const r of routesToExecute) {
            const config = routeConfig[r];
            if (!config) continue;

            const step4Query = parsers[config.parser];
            const joinTable = config.parser === "d365fo" ? "d365fo" : "client";

            const query = `
let d365Id = "${d365foId}";

let base =
union customEvents, exceptions
| extend 
    custom_d365fo_id = tostring(customDimensions.custom_d365fo_id),
    custom_request_id = tostring(customDimensions.custom_request_id),
    custom_route = tostring(customDimensions.custom_route),
    custom_type = tostring(customDimensions.custom_type),
    custom_sub_type = tostring(customDimensions.custom_sub_type)
| where custom_d365fo_id == d365Id
| where custom_type == "${config.type}"
| where custom_sub_type == "${config.subType}"
| where tolower(custom_route) == tolower("${r}")
| project 
    operation_Id,
    base_timestamp = timestamp,
    custom_d365fo_id,
    custom_request_id,
    custom_route,
    custom_type,
    custom_sub_type;

let opIds = base | distinct operation_Id;

let apim =
requests
| where operation_Id in (opIds)
| extend response_code = toint(resultCode)
| extend apim_status = response_code between (200 .. 299)
| summarize apim_status = any(apim_status) by operation_Id;

${step4Query}

let ex =
exceptions
| where operation_Id in (opIds)
| summarize arg_max(timestamp, *) by operation_Id
| extend 
    exception_message = coalesce(
        tostring(outerMessage),
        tostring(innermostMessage),
        tostring(message),
        tostring(details[0].message),
        ""
    )
| project operation_Id, exception_message;

base
| summarize arg_max(base_timestamp, *) by operation_Id
| join kind=leftouter apim on operation_Id
| join kind=leftouter ${joinTable} on operation_Id
| join kind=leftouter ex on operation_Id
| extend log_str = coalesce(log_str, "")
| extend 
    apim_status = iff(isnull(apim_status), false, apim_status),
    d365fo_status = column_ifexists("d365fo_status", false),
    client_status = column_ifexists("client_status", false),
    exception_message = coalesce(exception_message, "")
| extend has_log = strlen(log_str) > 0
| extend 
    d365fo_status = iff(has_log == false, false, d365fo_status),
    client_status = iff(has_log == false, false, client_status)
| extend 
    status = ${config.parser === "d365fo" ? "d365fo_status" : "client_status"},
    status_source = "${config.parser}"
| extend 
    final_status = case(
        isempty(exception_message) == false, "Failed",
        apim_status == false, "Failed",
        status == false, "Failed",
        "Success"
    )
| extend executed_route = "${r}"
| project 
    timestamp = base_timestamp,
    operation_Id,
    custom_d365fo_id,
    custom_request_id,
    custom_route,
    custom_type,
    custom_sub_type,
    final_status,
    apim_status,
    status,
    status_source,
    exception_message,
    log = tostring(log_str),
    executed_route
| order by timestamp desc
`;

            const url = `https://api.applicationinsights.io/v1/apps/${APP_ID}/query?timespan=${timespan}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": API_KEY,
                },
                body: JSON.stringify({ query }),
                agent: httpsAgent,
            });

            const data = await response.json();

            if (data?.tables?.length > 0) {
                finalResults.push(...data.tables[0].rows);
            }
        }

        // =========================
        // FINAL RESPONSE
        // =========================
        return Response.json({
            bucket: bucket || null,
            routesExecuted: routesToExecute,
            count: finalResults.length,
            results: finalResults,
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}