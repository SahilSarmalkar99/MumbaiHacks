import React, { useState } from 'react';
import { MessageCircle, Send, FileImage, FileText, Download } from 'lucide-react';
import { Invoice } from '../../types';
import { shareInvoiceToWhatsApp, generateDefaultMessage } from '../../utils/whatsappShare';

interface WhatsAppShareProps {
  invoice: Invoice;
  onShare: (phoneNumber: string, message: string) => void;
  elementId?: string;
}

export const WhatsAppShare: React.FC<WhatsAppShareProps> = ({ invoice, onShare, elementId = 'invoice-preview' }) => {
  const [phoneNumber, setPhoneNumber] = useState(invoice.customerPhone || '');
  const [customMessage, setCustomMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [shareFormat, setShareFormat] = useState<'text' | 'pdf' | 'jpg'>('text');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMessage = () => {
    return customMessage || generateDefaultMessage(invoice);
  };

  const handleShare = async () => {
    if (!phoneNumber) {
      alert('Please enter a phone number');
      return;
    }
    
    const message = generateMessage();
    setIsGenerating(true);
    
    try {
      const success = await shareInvoiceToWhatsApp({
        format: shareFormat,
        phoneNumber,
        message,
        elementId
      }, invoice);
      
      if (success) {
        onShare(phoneNumber, message);
        setShowModal(false);
      } else {
        alert('Error sharing invoice. Please try again.');
      }
    } catch (error) {
      console.error('Error sharing invoice:', error);
      alert('Error sharing invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };



  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        <MessageCircle className="w-4 h-4" />
        Share on WhatsApp
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Share Invoice on WhatsApp</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Share Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShareFormat('text')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  shareFormat === 'text'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Text Only</span>
              </button>
              <button
                type="button"
                onClick={() => setShareFormat('pdf')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  shareFormat === 'pdf'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setShareFormat('jpg')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  shareFormat === 'jpg'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileImage className="w-4 h-4" />
                <span className="text-sm font-medium">JPG</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Leave empty for default message..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-xs text-gray-600 mb-2">Preview:</p>
            <p className="text-sm whitespace-pre-line">{generateMessage()}</p>
          </div>

          {shareFormat !== 'text' && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-xs text-blue-600 mb-2">📎 File Sharing:</p>
              <p className="text-sm text-blue-700">
                The {shareFormat.toUpperCase()} file will be downloaded to your device. You can then manually attach it to your WhatsApp message.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={isGenerating}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {shareFormat === 'text' ? 'Send via WhatsApp' : `Download ${shareFormat.toUpperCase()} & Share`}
                </>
              )}
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};