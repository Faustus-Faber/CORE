import React, { useState, useRef, useEffect } from "react";
import { ocrApi, OCRAnnotation } from "../services/ocrApi";
import { toast } from "react-hot-toast";

const OCRToolPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fullText: string; annotations: OCRAnnotation[]; imageUrl: string } | null>(null);
  const [editableAnnotations, setEditableAnnotations] = useState<OCRAnnotation[]>([]);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size exceeds 10MB limit");
        return;
      }
      setFile(selectedFile);
      setImageUrl(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await ocrApi.extractText(file);
      setResult(res);
      setEditableAnnotations(res.annotations);
      toast.success("Text extracted successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to extract text");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await ocrApi.saveOCR({
        fullText: editableAnnotations.map(a => a.text).join("\n"),
        annotations: editableAnnotations,
        imageUrl: result.imageUrl
      });
      toast.success("OCR result saved to history!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save OCR result");
    }
  };

  const handleEditAnnotation = (index: number, newText: string) => {
    const updated = [...editableAnnotations];
    updated[index].text = newText;
    setEditableAnnotations(updated);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  useEffect(() => {
    if (imageRef.current && result) {
      const img = imageRef.current;
      setScale({
        x: img.clientWidth / img.naturalWidth,
        y: img.clientHeight / img.naturalHeight
      });
    }
  }, [result]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">OCR Tool</h1>
      <p className="text-gray-600 mb-8">
        Upload an image of disaster-damaged areas, vehicles, or signage to extract vital information.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Upload & Image View */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Image (JPG, PNG, WEBP - Max 10MB)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {imageUrl && (
            <div className="relative border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center min-h-[400px]">
              <img 
                ref={imageRef}
                src={imageUrl} 
                alt="Upload preview" 
                className="max-w-full max-h-[600px] object-contain"
                onLoad={() => {
                  if (imageRef.current) {
                    setScale({
                      x: imageRef.current.clientWidth / imageRef.current.naturalWidth,
                      y: imageRef.current.clientHeight / imageRef.current.naturalHeight
                    });
                  }
                }}
              />
              {result && editableAnnotations.map((anno, i) => (
                <div 
                  key={i}
                  className="absolute border-2 border-red-500 bg-red-500 bg-opacity-10 pointer-events-none"
                  style={{
                    left: (anno.boundingBox.x * scale.x),
                    top: (anno.boundingBox.y * scale.y),
                    width: (anno.boundingBox.width * scale.x),
                    height: (anno.boundingBox.height * scale.y)
                  }}
                />
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              onClick={handleExtract}
              disabled={!file || loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow transition disabled:opacity-50"
            >
              {loading ? "Processing..." : "Extract Text"}
            </button>
            {result && (
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
              >
                Save Results
              </button>
            )}
          </div>
        </div>

        {/* Right: Results Panel */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Extracted Text Panel</h2>
          
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <span className="text-5xl mb-4">🔍</span>
              <p>Upload and scan an image to see results here.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {editableAnnotations.map((anno, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200 group">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      anno.category === 'License Plate' ? 'bg-blue-100 text-blue-700' :
                      anno.category === 'Warning Label' ? 'bg-red-100 text-red-700' :
                      anno.category === 'Street Address' ? 'bg-green-100 text-green-700' :
                      'bg-gray-200 text-gray-700'
                    }`}>
                      {anno.category || 'General Text'}
                    </span>
                    <span className="text-xs text-gray-500">{(anno.confidence * 100).toFixed(1)}% confidence</span>
                  </div>
                  <input
                    type="text"
                    value={anno.text}
                    onChange={(e) => handleEditAnnotation(i, e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  />
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button 
                      onClick={() => handleCopy(anno.text)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRToolPage;
