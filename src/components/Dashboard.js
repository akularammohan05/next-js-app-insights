"use client";

import { useEffect, useState } from "react";
import {
    CheckCircleIcon,
    XCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "@heroicons/react/24/solid";

export default function Dashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [timezone, setTimezone] = useState("IST");
    const [expanded, setExpanded] = useState({});
    const [showFailedOnly, setShowFailedOnly] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const getParams = () => {
        const params = new URLSearchParams(window.location.search);
        const all = Object.fromEntries(params.entries());

        return {
            d365foId: all.d365foId || all.d365foid || "",
            route: all.route || "",
            bucket: all.bucket || "",
        };
    };

    useEffect(() => {
        const { d365foId, route, bucket } = getParams();

        if (!d365foId || (!route && !bucket)) {
            setErrorMessage("D365FO ID or Route is missing");
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setErrorMessage("");

            try {
                const url = bucket
                    ? `/api/appinsights?d365foId=${d365foId}&bucket=${bucket}`
                    : `/api/appinsights?d365foId=${d365foId}&route=${route}`;

                const res = await fetch(url);
                const json = await res.json();

                let rows = [];

                if (json?.tables) {
                    const table = json.tables[0];

                    if (table && table.rows.length) {
                        const cols = table.columns.map((c) => c.name);

                        rows = table.rows.map((r, index) => {
                            const obj = {};
                            cols.forEach((c, i) => (obj[c] = r[i]));
                            return { ...obj, id: index };
                        });
                    }
                } else if (json?.results) {
                    rows = json.results.map((r, index) => ({
                        timestamp: r[0],
                        operation_Id: r[1],
                        custom_d365fo_id: r[2],
                        custom_request_id: r[3],
                        custom_route: r[4],
                        custom_type: r[5],
                        custom_sub_type: r[6],
                        final_status: r[7],
                        apim_status: r[8],
                        status: r[9],
                        status_source: r[10],
                        exception_message: r[11],
                        log: r[12],
                        executed_route: r[13],
                        id: index,
                    }));
                }

                if (!rows || rows.length === 0) {
                    setErrorMessage("No Data Found");
                    setData([]);
                    return;
                }

                const mappedRows = rows.map((obj, index) => {
                    if (obj.final_status === "Correlation Not Found") {
                        return {
                            ...obj,
                            id: index,
                            overallStatus: false,
                            statusApim: false,
                            statusFn1: false,
                            statusFn2: false,
                            statusMain: false,
                            statusSource: "unknown",
                            error: "No logs found",
                        };
                    }

                    const apimStatus = obj.apim_status === true;
                    const mainStatus = obj.status === true;
                    const source = obj.status_source;
                    const overallStatus = obj.final_status === "Success";

                    return {
                        ...obj,
                        id: index,
                        statusApim: apimStatus,
                        statusFn1: apimStatus,
                        statusFn2: mainStatus,
                        statusMain: mainStatus,
                        statusSource: source,
                        overallStatus,
                        error: obj.exception_message || "",
                    };
                });

                setData(mappedRows);
            } catch (err) {
                console.error("Fetch error:", err);
                setErrorMessage("Something went wrong");
                setData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const toggleExpand = (id) => {
        setExpanded((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const formatDate = (utcDate) => {
        const date = new Date(utcDate);

        return timezone === "IST"
            ? date.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour12: true,
            })
            : date.toLocaleString("en-US", {
                timeZone: "UTC",
                hour12: true,
            });
    };

    const StatusBadge = ({ status }) => (
        <span
            className={`flex items-center gap-1 text-sm font-semibold ${status ? "text-green-600" : "text-red-600"
                }`}
        >
            {status ? (
                <CheckCircleIcon className="w-5 h-5" />
            ) : (
                <XCircleIcon className="w-5 h-5" />
            )}
            {status ? "Success" : "Failed"}
        </span>
    );

    const StatusList = ({ item }) => (
        <div className="border p-4 mt-2 rounded bg-gray-50">
            <div className="flex justify-between py-2 border-b">
                <span>APIM</span>
                <StatusBadge status={item.statusApim} />
            </div>

            <div className="flex justify-between py-2 border-b">
                <span>Function App 1</span>
                <StatusBadge status={item.statusFn1} />
            </div>

            <div className="flex justify-between py-2 border-b">
                <span>Function App 2</span>
                <StatusBadge status={item.statusFn2} />
            </div>

            <div className="flex justify-between py-2">
                <span>
                    {item.statusSource === "client"
                        ? "Client System"
                        : "D365FO"}
                </span>
                <StatusBadge status={item.statusMain} />
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="text-lg font-semibold">Checking logs...</div>
                <div className="text-gray-500 text-sm mt-2">
                    Please wait a few seconds
                </div>
            </div>
        );
    }

    if (!data.length) {
        return (
            <div className="p-6 text-center">
                <div className="text-xl font-semibold text-red-600">
                    {errorMessage || "No Data Found"}
                </div>
            </div>
        );
    }

    const filteredData = showFailedOnly
        ? data.filter((d) => !d.overallStatus)
        : data;

    const first = data[0];

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">
                    Integration Execution Monitor
                </h2>

                <div className="flex justify-between mb-6">
                    <div>
                        <span className="mr-2 font-medium">Timezone</span>

                        <button
                            className={`px-3 py-1 ${timezone === "IST"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200"
                                }`}
                            onClick={() => setTimezone("IST")}
                        >
                            IST
                        </button>

                        <button
                            className={`px-3 py-1 ${timezone === "GMT"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200"
                                }`}
                            onClick={() => setTimezone("GMT")}
                        >
                            GMT
                        </button>
                    </div>

                    <button
                        onClick={() => setShowFailedOnly(!showFailedOnly)}
                        className="px-3 py-1 bg-red-500 text-white rounded"
                    >
                        {showFailedOnly ? "Show All" : "Show Failed Only"}
                    </button>
                </div>

                <div className="mb-4">
                    <p><b>D365FO ID:</b> {first.custom_d365fo_id}</p>
                </div>

                <div className="mb-4">
                    <StatusBadge status={first.overallStatus} />
                </div>

                {filteredData.map((item, index) => (
                    <div key={item.id} className="mb-6">

                        {/* ✅ FIXED RIBBON */}
                        <div
                            className="flex justify-between items-center bg-blue-600 text-white p-3 rounded cursor-pointer"
                            onClick={() => toggleExpand(item.id)}
                        >
                            <div className="flex flex-col">
                                <span>
                                    Execution {index + 1} | {formatDate(item.timestamp)}
                                </span>

                                <span className="text-xs opacity-90">
                                    {item.custom_type} | {item.custom_sub_type}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <StatusBadge status={item.overallStatus} />

                                {expanded[item.id] ? (
                                    <ChevronUpIcon className="w-5 h-5" />
                                ) : (
                                    <ChevronDownIcon className="w-5 h-5" />
                                )}
                            </div>
                        </div>

                        {expanded[item.id] && (
                            <div className="p-4">
                                <div className="text-sm space-y-1 mb-2">
                                    <p><b>Correlation ID:</b> {item.custom_request_id}</p>
                                    <p><b>Route:</b> {item.custom_route || "-"}</p>
                                    <p><b>Executed Route:</b> {item.executed_route || "-"}</p>
                                    <p><b>Type:</b> {item.custom_type}</p>
                                    <p><b>Sub Type:</b> {item.custom_sub_type}</p>
                                </div>

                                <StatusList item={item} />

                                {item.error && (
                                    <div className="mt-2 text-red-600 font-semibold">
                                        {item.error}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}