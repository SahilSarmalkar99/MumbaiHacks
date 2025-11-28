import React, { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Save, RotateCcw, Trash2 } from 'lucide-react';

interface SignaturePadComponentProps {
  onSave: (signature: string) => void;
  initialSignature?: string;
}

export const SignaturePadComponent: React.FC<SignaturePadComponentProps> = ({ onSave, initialSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 1,
        maxWidth: 2.5,
      });

      signaturePadRef.current.addEventListener('beginStroke', () => {
        setIsEmpty(false);
      });

      if (initialSignature) {
        signaturePadRef.current.fromDataURL(initialSignature);
        setIsEmpty(false);
      }

      // Resize canvas
      const resizeCanvas = () => {
        if (canvasRef.current && signaturePadRef.current) {
          const canvas = canvasRef.current;
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext('2d')?.scale(ratio, ratio);
          signaturePadRef.current.clear();
          if (initialSignature) {
            signaturePadRef.current.fromDataURL(initialSignature);
          }
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [initialSignature]);

  const handleSave = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataURL = signaturePadRef.current.toDataURL();
      onSave(dataURL);
    }
  };

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-48 border border-gray-200 rounded"
          style={{ touchAction: 'none' }}
        />
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isEmpty}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          <Save className="w-4 h-4" />
          Save Signature
        </button>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>
      
      <p className="text-sm text-gray-600">
        Draw your signature above. It will be used on all invoices.
      </p>
    </div>
  );
};