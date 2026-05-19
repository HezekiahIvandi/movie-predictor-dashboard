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
  BarChart3,
  Info,
} from "lucide-react";
import { RatingComparison } from "@/components/RatingComparison";

type PredictResponse = {
  movie_id: string;
  predicted_rating: number;
  comment_text: string;
  actual_rating?: number;
};

interface ExcelRow {
  title?: string;
  comment?: string;
  imdb_rating?: string | number;
}

type MovieCommentInput = {
  title: string;
  comment: string;
  imdb_rating: number | null;
};

type PredictionResult = {
  movie_id: string;
  average_rating: number;
  actual_rating?: number;
};

export default function PredictorPage() {
  const [data, setData] = useState<MovieCommentInput[]>([]);
  const [fileName, setFileName] = useState("");
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(
    null,
  );
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState<string>("");

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
    setShowComparison(false);
    setSelectedMovieId("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as ExcelRow[];

      if (json.length === 0) {
        setError("Import failed: The uploaded file is empty.");
        setFileName("");
        setData([]);
        if (e.target) e.target.value = "";
        return;
      }

      const firstRow = json[0];
      const hasTitle = "title" in firstRow;
      const hasComment = "comment" in firstRow;

      if (!hasTitle || !hasComment) {
        setError(
          "Import failed: The uploaded file must contain both 'title' and 'comment' columns.",
        );
        setFileName("");
        setData([]);
        if (e.target) e.target.value = "";
        return;
      }

      const comments: MovieCommentInput[] = json.map((d) => ({
        title: d.title || "",
        comment: d.comment || "",
        imdb_rating:
          d.imdb_rating !== undefined && d.imdb_rating !== ""
            ? Number(d.imdb_rating)
            : null,
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
        imdb_rating: d?.imdb_rating || null,
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
      const result: PredictResponse[] = await res.json();
      const grouped: Record<string, number[]> = {};
      const actualRatings: Record<string, number> = {};

      result.forEach((r: PredictResponse) => {
        if (!grouped[r.movie_id]) grouped[r.movie_id] = [];
        grouped[r.movie_id].push(r.predicted_rating);

        if (r.actual_rating !== undefined && r.actual_rating !== null) {
          actualRatings[r.movie_id] = r.actual_rating;
        }
      });

      const averaged: PredictionResult[] = Object.entries(grouped).map(
        ([movie_id, ratings]) => {
          let actual: number | undefined = actualRatings[movie_id];
          if (actual === undefined) {
            const matchingInput = data.find((d) => d.title === movie_id);
            if (matchingInput && matchingInput.imdb_rating !== null) {
              actual = matchingInput.imdb_rating;
            }
          }

          return {
            movie_id,
            average_rating:
              ratings.reduce((a, b) => a + b, 0) / (ratings.length || 1),
            ...(actual !== undefined ? { actual_rating: actual } : {}),
          };
        },
      );

      setPredictions(averaged);

      const firstWithActual = averaged.find(
        (p) => p.actual_rating !== undefined,
      );
      if (firstWithActual) {
        setSelectedMovieId(firstWithActual.movie_id);
      }

      // Smooth scroll to the results table once it's rendered
      setTimeout(() => {
        const resultsEl = document.getElementById("predictions-result");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
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

  const renderTable = (
    tableData: Record<string, string | number | boolean | null | undefined>[],
    title?: string,
  ) => {
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
                    {Object.values(row).map((v, j) => {
                      const key = Object.keys(row)[j];
                      const isLongText = key === "comment" || key === "title";
                      return (
                        <td
                          key={j}
                          className={`px-4 py-2.5 text-slate-600 ${
                            isLongText
                              ? "min-w-[240px] max-w-sm whitespace-normal break-words text-xs sm:text-sm"
                              : "whitespace-nowrap text-xs sm:text-sm"
                          }`}
                        >
                          {String(v)}
                        </td>
                      );
                    })}
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
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 px-4 py-6 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-2">
            <div className="flex items-center gap-2.5">
              <Film className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600 shrink-0" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent py-1">
                Movie Rating Predictor
              </h1>
            </div>
            <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1 rounded-full border border-slate-200/50 shadow-xs">
              {checkingBackend ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              ) : backendConnected === true ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : backendConnected === false ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : null}
              <span className="text-xs sm:text-sm font-medium text-slate-600">
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
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="text-slate-600 text-lg font-semibold">
              Prediction using pre-release comment
            </span>
            <div className="relative group cursor-pointer inline-flex items-center">
              <Info className="w-4.5 h-4.5 text-slate-400 hover:text-indigo-600 transition-colors" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-72 sm:w-80 p-3 bg-slate-900 text-white rounded-lg shadow-xl text-xs font-normal leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 text-left">
                This dashboard calculates expected movie scores by analyzing public audience comments and discussions posted <strong>before the movie's official release</strong>. By processing these early sentiment indicators, the predictor forecasts anticipated ratings, allowing you to gauge viewer anticipation and compare statistical predictions directly with actual IMDb rating results.
                {/* Tooltip Arrow */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="border-b bg-linear-to-r from-indigo-50 to-purple-50 pt-6">
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Dataset
            </CardTitle>
            <CardDescription>
              Upload an Excel or CSV file with{" "}
              <span className="font-semibold">title</span> and{" "}
              <span className="font-semibold">comment</span> columns. <br />
              Optionally include an <b>imdb_rating</b> column to compare with
              the model's predictions.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm text-sm font-semibold w-full sm:w-auto text-center"
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
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-md w-full sm:w-auto overflow-hidden">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="truncate">{fileName}</span>
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
            <CardHeader className="border-b bg-linear-to-r from-blue-50 to-sky-50 pt-6">
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
              <div className="flex justify-end w-full">
                <Button
                  onClick={handlePredict}
                  disabled={!hasValidColumns || loading}
                  className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-sm w-full sm:w-auto"
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
          <Card
            id="predictions-result"
            className="shadow-lg border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <CardHeader className="pt-6 border-b bg-linear-to-r from-green-50 to-emerald-50">
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
              <div className="flex flex-col sm:flex-row gap-3 justify-end w-full">
                <Button
                  onClick={handleDownload}
                  className="bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Results (.xlsx)
                </Button>
                {predictions.some(
                  (p) =>
                    p.actual_rating !== undefined &&
                    p.actual_rating !== null &&
                    p.actual_rating !== 0,
                ) && (
                  <Button
                    onClick={() => {
                      setShowComparison(!showComparison);
                      setTimeout(() => {
                        document
                          .getElementById("comparison-section")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }}
                    className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white animate-pulse w-full sm:w-auto"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    {showComparison
                      ? "Hide Comparison"
                      : "Compare with Actual Rating"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparison Section */}
        <RatingComparison
          predictions={predictions}
          selectedMovieId={selectedMovieId}
          setSelectedMovieId={setSelectedMovieId}
          showComparison={showComparison}
        />
      </div>
    </div>
  );
}
