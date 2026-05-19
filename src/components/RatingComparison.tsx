"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart3, Download, ChevronDown } from "lucide-react";
import { Chart, registerables } from "chart.js";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// Register all Chart.js components
Chart.register(...registerables);

export type PredictionResult = {
  movie_id: string;
  average_rating: number;
  actual_rating?: number;
};

interface RatingComparisonProps {
  predictions: PredictionResult[];
  selectedMovieId: string;
  setSelectedMovieId: (id: string) => void;
  showComparison: boolean;
}

export function RatingComparison({
  predictions,
  selectedMovieId,
  setSelectedMovieId,
  showComparison,
}: RatingComparisonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const hasActualRatings = predictions.some(
    (p) => p.actual_rating !== undefined && p.actual_rating !== null,
  );

  // Auto-select the first valid movie with an actual rating if none is selected or selection becomes invalid
  useEffect(() => {
    const validMovies = predictions.filter(
      (p) => p.actual_rating !== undefined && p.actual_rating !== null,
    );
    if (validMovies.length > 0) {
      const isValid = validMovies.some((p) => p.movie_id === selectedMovieId);
      if (!isValid) {
        setSelectedMovieId(validMovies[0].movie_id);
      }
    }
  }, [predictions, selectedMovieId, setSelectedMovieId]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize and update Chart.js
  useEffect(() => {
    if (!showComparison || !canvasRef.current) return;

    // Filter predictions that have actual ratings
    const validData = predictions.filter(
      (p) => p.actual_rating !== undefined && p.actual_rating !== null,
    );

    if (validData.length === 0) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart instance to prevent leaks
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = validData.map((d) => d.movie_id);
    const predictedRatings = validData.map((d) => d.average_rating);
    const actualRatings = validData.map((d) => d.actual_rating as number);

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Predicted Rating (Average)",
            data: predictedRatings,
            backgroundColor: "rgba(99, 102, 241, 0.8)", // indigo-500
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: "Actual Rating (IMDb)",
            data: actualRatings,
            backgroundColor: "rgba(14, 165, 233, 0.8)", // sky-500
            borderColor: "rgba(14, 165, 233, 1)",
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              font: {
                family: "Inter, sans-serif",
                weight: 500,
              },
              color: "#334155",
            },
          },
          title: {
            display: true,
            text: "Dataset Comparison: Predictions vs. IMDb Ratings",
            font: {
              family: "Inter, sans-serif",
              size: 15,
              weight: 600,
            },
            color: "#1e293b",
            padding: {
              bottom: 15,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            grid: {
              color: "rgba(226, 232, 240, 0.6)",
            },
            ticks: {
              font: {
                family: "Inter, sans-serif",
              },
              color: "#64748b",
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                family: "Inter, sans-serif",
              },
              color: "#64748b",
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [showComparison, predictions]);

  // Export Chart.js as a high-quality PNG image with solid white background
  const handleDownloadChart = () => {
    if (!canvasRef.current) return;
    const originalCanvas = canvasRef.current;
    
    // Create temporary canvas to paint solid white background
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalCanvas.width;
    tempCanvas.height = originalCanvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Fill white background
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the chart onto it
    tempCtx.drawImage(originalCanvas, 0, 0);

    const imageURI = tempCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageURI;
    link.download = "movie_ratings_comparison_chart.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!showComparison || !hasActualRatings) return null;

  const selectedData = predictions.find((p) => p.movie_id === selectedMovieId);
  if (!selectedData || selectedData.actual_rating === undefined) {
    return (
      <Card
        id="comparison-section"
        className="shadow-xl border-slate-200 bg-white"
      >
        <CardContent className="py-6 text-center text-slate-400">
          Please select a movie to view the comparison chart.
        </CardContent>
      </Card>
    );
  }

  const predRating = selectedData.average_rating;
  const actRating = selectedData.actual_rating;
  const difference = predRating - actRating;
  const absDifference = Math.abs(difference).toFixed(2);

  const predPercentage = (predRating / 10) * 100;
  const actPercentage = (actRating / 10) * 100;

  let accuracyLabel = "Highly Accurate";
  let accuracyBg = "bg-green-50 text-green-700 border-green-200";
  if (Math.abs(difference) > 1.5) {
    accuracyLabel = "Significant Variance";
    accuracyBg = "bg-red-50 text-red-700 border-red-200";
  } else if (Math.abs(difference) > 0.5) {
    accuracyLabel = "Moderate Accuracy";
    accuracyBg = "bg-amber-50 text-amber-700 border-amber-200";
  }

  return (
    <Card
      id="comparison-section"
      className="shadow-xl border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white divide-y divide-slate-100"
    >
      {/* 1. Single Movie Drilldown Panel */}
      <div>
        <CardHeader className="pt-6 border-b bg-linear-to-r from-indigo-50/30 to-purple-50/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Rating Comparison Analysis (Drilldown)
              </CardTitle>
              <CardDescription className="text-slate-500">
                Compare average predicted rating vs. actual IMDb rating per individual movie
              </CardDescription>
            </div>
            {/* Movie Selector Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">
                Select Movie:
              </span>
              <div className="relative" ref={dropdownRef}>
                {/* Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center justify-between w-56 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs cursor-pointer transition-all duration-200"
                >
                  <span className="truncate">{selectedMovieId || "Select a movie..."}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Popover Options Menu */}
                {isOpen && (
                  <div className="absolute left-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1.5 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-1.5 space-y-1">
                      {predictions
                        .filter((p) => p.actual_rating !== undefined && p.actual_rating !== null)
                        .map((p) => {
                          const isSelected = p.movie_id === selectedMovieId;
                          return (
                            <button
                              key={p.movie_id}
                              type="button"
                              onClick={() => {
                                setSelectedMovieId(p.movie_id);
                                setIsOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            >
                              <span className="truncate">{p.movie_id}</span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Visual Comparison Chart */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-50/60 rounded-xl p-6 border border-slate-100">
                <div className="text-sm font-semibold text-slate-700 mb-6 flex justify-between">
                  <span>Comparison Visualization</span>
                  <span className="text-slate-400 text-xs">
                    Scale: 0.0 - 10.0
                  </span>
                </div>

                <div className="space-y-6">
                  {/* Predicted Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-indigo-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                        Predicted Rating (Average)
                      </span>
                      <span className="text-indigo-900 font-semibold">
                        {predRating.toFixed(2)} / 10
                      </span>
                    </div>
                    <div className="h-4 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${predPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Actual Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-sky-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                        Actual Rating (IMDb)
                      </span>
                      <span className="text-sky-900 font-semibold">
                        {actRating.toFixed(2)} / 10
                      </span>
                    </div>
                    <div className="h-4 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${actPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Grid lines */}
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-4 px-1">
                  <span>0</span>
                  <span>2</span>
                  <span>4</span>
                  <span>6</span>
                  <span>8</span>
                  <span>10</span>
                </div>
              </div>
            </div>

            {/* Stats & Callouts */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-4">
                <div className="border border-slate-100 rounded-xl p-5 bg-white shadow-sm">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Accuracy Insights
                  </h4>

                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${accuracyBg}`}
                    >
                      {accuracyLabel}
                    </span>
                    <span className="text-xs text-slate-500">
                      Error: {absDifference}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {difference > 0 ? (
                      <>
                        The predictor rated{" "}
                        <span className="font-semibold text-slate-800">
                          "{selectedMovieId}"
                        </span>{" "}
                        <span className="font-semibold text-indigo-600">
                          {absDifference} points higher
                        </span>{" "}
                        than its actual IMDb rating.
                      </>
                    ) : difference < 0 ? (
                      <>
                        The predictor rated{" "}
                        <span className="font-semibold text-slate-800">
                          "{selectedMovieId}"
                        </span>{" "}
                        <span className="font-semibold text-sky-600">
                          {absDifference} points lower
                        </span>{" "}
                        than its actual IMDb rating.
                      </>
                    ) : (
                      <>
                        The predictor perfectly matched the actual IMDb rating
                        of{" "}
                        <span className="font-semibold text-slate-800">
                          "{selectedMovieId}"
                        </span>
                        !
                      </>
                    )}
                  </p>
                </div>

                {/* SVG Gauge Comparison */}
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-center justify-around">
                  <div className="text-center">
                    <span className="text-xs text-slate-500 block mb-1">
                      Predicted Score
                    </span>
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="#e2e8f0"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="url(#compIndigoGrad)"
                          strokeWidth="5"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 26}
                          strokeDashoffset={
                            2 * Math.PI * 26 * (1 - predRating / 10)
                          }
                          className="transition-all duration-1000 ease-out"
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient
                            id="compIndigoGrad"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute text-sm font-bold text-slate-700">
                        {predRating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="text-xs text-slate-500 block mb-1">
                      IMDb Score
                    </span>
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="#e2e8f0"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="url(#compSkyGrad)"
                          strokeWidth="5"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 26}
                          strokeDashoffset={
                            2 * Math.PI * 26 * (1 - actRating / 10)
                          }
                          className="transition-all duration-1000 ease-out"
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient
                            id="compSkyGrad"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#0ea5e9" />
                            <stop offset="100%" stopColor="#2563eb" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute text-sm font-bold text-slate-700">
                        {actRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </div>

      {/* 2. Global Dataset Overview (ChartJS Interactive Canvas) */}
      <div>
        <CardContent className="py-8">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-96 relative">
            <canvas ref={canvasRef} />
          </div>
          <div className="flex justify-end w-full mt-4">
            <button
              onClick={handleDownloadChart}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download Chart (.png)
            </button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
