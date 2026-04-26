"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  Film,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Download,
  Table,
} from "lucide-react";

export default function PredictorPage() {
  const [data, setData] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(
    null,
  );
  const [checkingBackend, setCheckingBackend] = useState(false);

  // Check backend health
  const checkBackendHealth = async () => {
    setCheckingBackend(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });
      setBackendConnected(res.ok);
    } catch {
      setBackendConnected(false);
    } finally {
      setCheckingBackend(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setPredictions([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const comments = json.map((d: any) => ({
        title: d.title,
        comment: d.comment,
      }));
      setData(comments);
    };
    reader.readAsBinaryString(file);
  };

  // Predict ratings
  const handlePredict = async () => {
    if (data.length === 0) return;
    setError("");
    setLoading(true);
    try {
      const comments = data.map((d) => ({
        movie_id: d.title,
        comment_text: d.comment,
      }));
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ data: comments }),
        },
      );
      if (!res.ok) throw new Error("Prediction failed");
      const result = await res.json();
      const grouped: Record<string, number[]> = {};
      result.forEach((r: any) => {
        if (!grouped[r.movie_id]) grouped[r.movie_id] = [];
        grouped[r.movie_id].push(r.predicted_rating);
      });

      const averaged = Object.entries(grouped).map(([movie_id, ratings]) => ({
        movie_id,
        average_rating:
          ratings.reduce((a, b) => a + b, 0) / (ratings.length || 1),
      }));

      setPredictions(averaged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Download predictions
  const handleDownload = () => {
    if (predictions.length === 0) return;
    const sheet = XLSX.utils.json_to_sheet(predictions);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Predictions");
    XLSX.writeFile(wb, "predicted_ratings.xlsx");
  };

  const hasValidColumns =
    data.length > 0 && ["title", "comment"].every((col) => col in data[0]);

  const renderTable = (tableData: any[], title?: string) => {
    if (tableData.length === 0) return null;
    return (
      <div className="space-y-3">
        {title && (
          <p className="text-sm font-medium text-slate-700">
            {title} ({tableData.length} rows)
          </p>
        )}
        <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  {Object.keys(tableData[0]).map((k) => (
                    <th
                      key={k}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tableData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    {Object.values(row).map((v, j) => (
                      <td
                        key={j}
                        className="px-4 py-2 text-slate-600 whitespace-nowrap"
                      >
                        {String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Film className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent py-1">
              Movie Rating Predictor
            </h1>
            <div className="flex items-center gap-2">
              {checkingBackend ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              ) : backendConnected === true ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : backendConnected === false ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : null}
              <span className="text-sm text-slate-600">
                {checkingBackend
                  ? "Checking backend..."
                  : backendConnected === true
                    ? "Backend connected"
                    : backendConnected === false
                      ? "Backend disconnected"
                      : "Checking backend..."}
              </span>
            </div>
          </div>
          <p className="text-slate-600 text-lg">
            Upload your dataset and predict movie ratings with AI
          </p>
        </div>

        {/* Upload Section */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 pt-6">
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Dataset
            </CardTitle>
            <CardDescription>
              Upload an Excel or CSV file with{" "}
              <span className="font-semibold">title</span> and{" "}
              <span className="font-semibold">comment</span> columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label
                htmlFor="file-upload"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Choose File
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              {fileName && (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-md">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {fileName}
                </div>
              )}
            </div>

            {!hasValidColumns && data.length > 0 && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  File must include <b>title</b> and <b>comment</b> columns.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Data Preview */}
        {data.length > 0 && hasValidColumns && (
          <Card className="shadow-md border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="border-b from-blue-50 to-sky-50 pt-6">
              <CardTitle className="flex items-center gap-2">
                <Table className="w-5 h-5 text-blue-600" />
                Data Preview
              </CardTitle>
              <CardDescription>
                Showing first 10 of {data.length} rows
              </CardDescription>
            </CardHeader>
            <CardContent className="py-6 space-y-4">
              {renderTable(data.slice(0, 10))}
              <div className="flex justify-end">
                <Button
                  onClick={handlePredict}
                  disabled={!hasValidColumns || loading}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Predicting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Predict Ratings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Predictions Table */}
        {predictions.length > 0 && (
          <Card className="shadow-lg border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pt-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Predicted Ratings
              </CardTitle>
              <CardDescription>
                {predictions.length} predictions generated successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="py-6 space-y-4">
              {renderTable(
                predictions.map((p) => ({
                  movie_id: p.movie_id,
                  average_rating: p.average_rating.toFixed(2),
                })),
              )}
              <Button
                onClick={handleDownload}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Results (.xlsx)
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
