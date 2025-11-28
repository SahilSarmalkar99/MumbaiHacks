import React, { useState } from 'react';
import { Share2, MessageCircle, Download, FileText, FileImage, Send, X } from 'lucide-react';
import { Invoice } from '../../types';
import { shareInvoiceToWhatsApp, generateDefaultMessage } from '../../utils/whatsappShare';

interface UniversalShareButtonProps {
  invoice: Invoice;
  elementId?: string;
  buttonText?: string;
  buttonSize?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  variant?: 'button' | 'icon';
  className?: string;
}

export const UniversalShareButton: React.FC<UniversalShareButtonProps> = ({
  invoice,
  elementId = 'invoice-preview',
  buttonText = 'Share',
  buttonSize = 'md',
  showIcon = true,
  variant = 'button',
  className = ''
}) => {
  const [showModal, setShowModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(invoice.customerPhone || '');
  const [customMessage, setCustomMessage] = useState('');
  const [shareFormat, setShareFormat] = useState<'text' | 'pdf' | 'jpg'>('text');
  const [isSharing, setIsSharing] = useState(false);

  const generateMessage = () => {
    return customMessage || generateDefaultMessage(invoice);
  };

  const handleShare = async () => {
    if (!phoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    const message = generateMessage();
    setIsSharing(true);

    try {
      const success = await shareInvoiceToWhatsApp({
        format: shareFormat,
        phoneNumber,
        message,
        elementId
      }, invoice);

      if (success) {
        setShowModal(false);
        // Reset form
        setCustomMessage('');
        setShareFormat('text');
      } else {
        alert('Error sharing invoice. Please try again.');
      }
    } catch (error) {
      console.error('Error sharing invoice:', error);
      alert('Error sharing invoice. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const getSizeClasses = () => {
    switch (buttonSize) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const getIconSize = () => {
    switch (buttonSize) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-4 h-4';
    }
  };

  const TriggerButton = () => {
    if (variant === 'icon') {
      return (
        <button
          onClick={() => setShowModal(true)}
          className={`p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors ${className}`}
          title="Share via WhatsApp"
        >
          <MessageCircle className={getIconSize()} />
        </button>
      );
    }

    return (
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${getSizeClasses()} ${className}`}
      >
        {showIcon && <Share2 className={getIconSize()} />}
        {buttonText}
      </button>
    );
  };

  if (!showModal) {
    return <TriggerButton />;
  }

  return (
    <>
      <TriggerButton />
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Share Invoice</h3>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Share Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Share Format</label>
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
                  <span className="text-sm font-medium">Text</span>
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

            {/* Phone Number */}
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

            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Leave empty for default message..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Message Preview */}
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-xs text-gray-600 mb-2">Preview:</p>
              <p className="text-sm whitespace-pre-line max-h-32 overflow-y-auto">{generateMessage()}</p>
            </div>

            {/* File Sharing Info */}
            {shareFormat !== 'text' && (
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-xs text-blue-600 mb-1">📎 File Sharing:</p>
                <p className="text-sm text-blue-700">
                  The {shareFormat.toUpperCase()} file will be downloaded. You can then attach it to your WhatsApp message.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sharing...
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
    </>
  );
};