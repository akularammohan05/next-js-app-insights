"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Squares2X2Icon,
    CubeIcon,
    ServerIcon,
    BuildingOffice2Icon
} from "@heroicons/react/24/solid";

// =====================
// DATA
// =====================
const data = {
    tables: [
        {
            name: "PrimaryResult",
            columns: [
                { name: "statusApim" },
                { name: "statusFnapp1" },
                { name: "statusFnapp2" },
                { name: "statusD365FO" },
                { name: "timestamp" },
                { name: "custom_d365fo_id" },
                { name: "custom_request_id" },
                { name: "custom_route" },
                { name: "custom_sub_type" },
                { name: "custom_type" },
                { name: "error" }
            ],
            rows: [
                [
                    "True", "True", "True", "True",
                    "2026-02-10T13:00:02.2198103Z",
                    "0587387a",
                    "0587387a",
                    "",
                    "ERP_CATEGORY_MASTER",
                    "ERP_CATEGORY_MASTER",
                    ""
                ],
                [
                    "False", "True", "True", "True",
                    "2026-02-05T13:00:04.6814863Z",
                    "0587387a",
                    "0587387a",
                    "category",
                    "ERP_CATEGORY_MASTER",
                    "ERP_CATEGORY_MASTER",
                    "APIM failed"
                ],
                [
                    "True", "True", "True", "True",
                    "2026-02-15T13:00:02.2198103Z",
                    "0587387a",
                    "0587387a",
                    "",
                    "ERP_CATEGORY_MASTER",
                    "ERP_CATEGORY_MASTER",
                    ""
                ]
            ]
        }
    ]
};

// =====================
// ICON MAP
// =====================
const icons = {
    APIM: Squares2X2Icon,
    "Function App 1": CubeIcon,
    "Function App 2": ServerIcon,
    D365FO: BuildingOffice2Icon
};

// =====================
// BADGE
// =====================
const Badge = ({ ok }) => (
    <span className={`flex items-center gap-2 text-sm ${ok ? "text-green-600" : "text-red-600"}`}>
        <span className={`w-5 h-5 rounded-full flex items-center justify-center ${ok ? "bg-green-600" : "bg-red-600"} text-white text-xs`}>
            {ok ? "✔" : "✖"}
        </span>
        {ok ? "Success" : "Failed"}
    </span>
);

// =====================
// MAIN
// =====================
export default function Dashboard() {

    // ✅ Dynamic query param support
    const searchParams = useSearchParams();
    const d365foIdFromUrl = searchParams.get("d365fo-id");

    const table = data.tables[0];

    // =====================
    // DATE FILTER
    // =====================
    const [timeRange, setTimeRange] = useState("15d");
    const [timezone, setTimezone] = useState("IST");
    const [showCustom, setShowCustom] = useState(false);

    const today = new Date();

    const getStartDate = (range) => {
        const d = new Date();
        if (range === "7d") d.setDate(d.getDate() - 7);
        if (range === "15d") d.setDate(d.getDate() - 15);
        if (range === "30d") d.setDate(d.getDate() - 30);
        return d;
    };

    const [startDate, setStartDate] = useState(getStartDate("15d"));
    const [endDate, setEndDate] = useState(today);

    const handleRangeChange = (value) => {
        setTimeRange(value);

        if (value === "custom") {
            setShowCustom(true);
        } else {
            setShowCustom(false);
            setStartDate(getStartDate(value));
            setEndDate(new Date());
        }
    };

    // =====================
    // FORMAT DATE
    // =====================
    const formatDate = (date) => {
        if (!date) return "-";

        if (timezone === "IST") {
            return new Date(date).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata"
            });
        }

        return new Date(date).toUTCString();
    };

    // =====================
    // MAP DATA
    // =====================
    const cols = table.columns.map(c => c.name);

    const rows = table.rows.map(r => {
        const obj = {};
        cols.forEach((c, i) => (obj[c] = r[i]));
        return obj;
    });

    // =====================
    // FILTER DATA
    // =====================
    const filteredRows = rows.filter(r => {
        const ts = new Date(r.timestamp);
        return ts >= startDate && ts <= endDate;
    });

    const [open, setOpen] = useState(0);
    const [selected, setSelected] = useState(0);

    const current = filteredRows[selected] || filteredRows[0];

    const overall = filteredRows.every(r =>
        r.statusApim === "True" &&
        r.statusFnapp1 === "True" &&
        r.statusFnapp2 === "True" &&
        r.statusD365FO === "True"
    );

    const components = [
        { key: "statusApim", label: "APIM" },
        { key: "statusFnapp1", label: "Function App 1" },
        { key: "statusFnapp2", label: "Function App 2" },
        { key: "statusD365FO", label: "D365FO" }
    ];

    return (
        <div className="min-h-screen bg-gray-100 p-6">

            <div className="max-w-[1600px] mx-auto bg-white rounded-lg shadow-sm border">

                <div className="bg-gray-50 p-6 border-b">

                    <h1 className="text-xl font-semibold text-gray-800 mb-4">
                        Integration Execution Monitor
                    </h1>

                    <div className="flex flex-wrap gap-6 mb-4 items-center">

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Time Range</label>

                            <select
                                value={timeRange}
                                onChange={(e) => handleRangeChange(e.target.value)}
                                className="border px-3 py-1 rounded text-sm"
                            >
                                <option value="7d">Last 7 Days</option>
                                <option value="15d">Last 15 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>

                        {showCustom && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={startDate.toISOString().slice(0, 10)}
                                    onChange={(e) => setStartDate(new Date(e.target.value))}
                                    className="border px-2 py-1 rounded text-sm"
                                />
                                <span>-</span>
                                <input
                                    type="date"
                                    value={endDate.toISOString().slice(0, 10)}
                                    onChange={(e) => setEndDate(new Date(e.target.value))}
                                    className="border px-2 py-1 rounded text-sm"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Timezone</span>

                            <button onClick={() => setTimezone("IST")}
                                className={`px-3 py-1 rounded text-sm ${timezone === "IST" ? "bg-blue-600 text-white" : "bg-white border"}`}>
                                IST
                            </button>

                            <button onClick={() => setTimezone("GMT")}
                                className={`px-3 py-1 rounded text-sm ${timezone === "GMT" ? "bg-blue-600 text-white" : "bg-white border"}`}>
                                GMT
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">

                        <div className="text-sm text-gray-700 space-y-1">
                            <p><b>Correlation ID:</b> {current?.custom_request_id}</p>
                            <p><b>D365FO ID:</b> {d365foIdFromUrl || current?.custom_d365fo_id}</p>
                            <p><b>Message Type:</b> {current?.custom_type}</p>
                        </div>

                        <div className="flex items-center gap-2 font-medium">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full ${overall ? "bg-green-600" : "bg-red-600"} text-white`}>
                                {overall ? "✔" : "✖"}
                            </span>
                            <span className={overall ? "text-green-600" : "text-red-600"}>
                                {overall ? "Success" : "Failed"}
                            </span>
                        </div>

                    </div>

                </div>

                <div className="p-4">

                    {filteredRows.map((r, i) => (

                        <div key={i} className="mb-4 border rounded-lg shadow-sm">

                            <div
                                onClick={() => {
                                    setOpen(open === i ? -1 : i);
                                    setSelected(i);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 flex justify-between cursor-pointer"
                            >
                                <span>
                                    {open === i ? "▼" : "▶"} Execution {i + 1} | {formatDate(r.timestamp)}
                                </span>

                                <button className="bg-white text-blue-600 px-2 rounded text-sm">
                                    {open === i ? "Hide" : "Show"}
                                </button>
                            </div>

                            {open === i && (
                                <div className="p-4 bg-gray-50">

                                    <table className="w-full text-sm border">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">Component</th>
                                                <th>Status</th>
                                                <th>Error</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {components.map((item) => {
                                                const Icon = icons[item.label];
                                                const ok = r[item.key] === "True";

                                                return (
                                                    <tr key={item.label} className="border-t">
                                                        <td className="p-2 flex items-center gap-2">
                                                            <Icon className="w-4 h-4 text-blue-600" />
                                                            {item.label}
                                                        </td>

                                                        <td><Badge ok={ok} /></td>
                                                        <td>{ok ? "-" : r.error}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                </div>
                            )}

                        </div>

                    ))}

                </div>

            </div>

        </div>
    );
}