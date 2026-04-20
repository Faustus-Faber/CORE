import React, { useEffect, useState } from "react";
import { ocrApi, OCRResult } from "../services/ocrApi";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";

const OCRHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<OCRResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await ocrApi.getHistory();
        setHistory(data);
      } catch (err: any) {
        toast.error("Failed to load OCR history");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading history...</div>;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">OCR Scan History</h1>
        <Link to="/ocr-tool" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          New Scan
        </Link>
      </div>

      {history.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
          <p className="text-xl mb-4">No OCR scans found.</p>
          <Link to="/ocr-tool" className="text-blue-600 hover:underline">Start your first scan now</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="OCR Source" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400">No Image</span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                  {item.fileId && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Attached to File</span>}
                </div>
                <p className="text-sm font-medium text-gray-800 line-clamp-3 mb-4 flex-1">
                  {item.fullText}
                </p>
                <div className="flex justify-end gap-2 mt-auto">
                  {/* Future: View Details Modal */}
                  <button className="text-xs text-blue-600 hover:underline">View Full Result</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OCRHistoryPage;
