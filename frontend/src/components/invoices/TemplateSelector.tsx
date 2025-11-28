import React from 'react';
import { Check } from 'lucide-react';
import { InvoiceTemplateType } from '../../types';

interface TemplateSelectorProps {
  selectedTemplate: InvoiceTemplateType;
  onTemplateChange: (template: InvoiceTemplateType) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ selectedTemplate, onTemplateChange }) => {
  const templates = [
    { id: 'classic', name: 'Classic', color: 'bg-blue-100', accent: 'bg-blue-600' },
    { id: 'modern', name: 'Modern', color: 'bg-purple-100', accent: 'bg-purple-600' },
    { id: 'minimal', name: 'Minimal', color: 'bg-gray-100', accent: 'bg-gray-600' },
    { id: 'professional', name: 'Professional', color: 'bg-green-100', accent: 'bg-green-600' },
    { id: 'colorful', name: 'Colorful', color: 'bg-orange-100', accent: 'bg-orange-600' },
    { id: 'elegant', name: 'Elegant', color: 'bg-indigo-100', accent: 'bg-indigo-600' },
    { id: 'bold', name: 'Bold', color: 'bg-red-100', accent: 'bg-red-600' },
    { id: 'simple', name: 'Simple', color: 'bg-teal-100', accent: 'bg-teal-600' }
  ];

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">Choose Invoice Template</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => onTemplateChange(template.id as InvoiceTemplateType)}
            className={`relative cursor-pointer p-4 rounded-lg border-2 transition-all ${
              selectedTemplate === template.id 
                ? 'border-blue-500 ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-full h-16 ${template.color} rounded mb-2 relative overflow-hidden`}>
              <div className={`h-4 ${template.accent} w-full`}></div>
              <div className="p-2">
                <div className="h-1 bg-gray-400 w-3/4 mb-1"></div>
                <div className="h-1 bg-gray-300 w-1/2"></div>
              </div>
            </div>
            <p className="text-sm font-medium text-center">{template.name}</p>
            {selectedTemplate === template.id && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                <Check className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};