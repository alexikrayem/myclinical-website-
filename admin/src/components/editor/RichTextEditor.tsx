import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import { Wand2, Loader } from 'lucide-react';
import 'react-quill/dist/quill.snow.css';
import { api } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'اكتب المحتوى هنا...',
  height = '300px'
}) => {
  const [showAIModal, setShowAIModal] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [inputType, setInputType] = React.useState<'file' | 'text'>('text');
  const [file, setFile] = React.useState<File | null>(null);
  const [textInput, setTextInput] = React.useState('');

  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image'],
      [{ 'color': [] }, { 'background': [] }],
      ['blockquote', 'code-block'],
      ['clean']
    ],
  }), []);

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background',
    'align', 'code-block'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.type === 'text/plain') {
        setFile(selectedFile);
      } else {
        toast.error('يرجى اختيار ملف PDF أو نص فقط');
      }
    }
  };

  const generateContent = async () => {
    if (inputType === 'file' && !file) {
      toast.error('يرجى اختيار ملف');
      return;
    }

    if (inputType === 'text' && !textInput.trim()) {
      toast.error('يرجى إدخال النص');
      return;
    }

    setAiLoading(true);

    try {
      const formData = new FormData();

      if (inputType === 'file' && file) {
        formData.append('file', file);
      } else {
        formData.append('textInput', textInput);
      }

      formData.append('language', 'arabic');
      formData.append('articleType', 'article');

      const response = await api.post('/ai/generate-content', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        onChange(response.data.content);
        toast.success('تم توليد المحتوى بنجاح!');
        setShowAIModal(false);
        setFile(null);
        setTextInput('');
      }

    } catch (error: any) {
      console.error('Error generating content:', error);
      const errorMessage = error.response?.data?.error || 'حدث خطأ أثناء توليد المحتوى';
      toast.error(errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAIModal(true)}
          className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl transition-all flex items-center text-sm"
        >
          <Wand2 size={16} className="ml-2" />
          توليد المحتوى بالذكاء الاصطناعي
        </button>
      </div>

      <div className="bg-white rounded-lg border">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{
            height: height,
            direction: 'rtl'
          }}
        />
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                    <Wand2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">توليد المحتوى بالذكاء الاصطناعي</h2>
                    <p className="text-sm text-gray-500">قم بتحويل الأبحاث والنصوص إلى محتوى احترافي</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Input Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">نوع المدخل</label>
                <div className="flex space-x-4 space-x-reverse">
                  <button
                    onClick={() => setInputType('text')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${inputType === 'text'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium">إدخال نص</div>
                    <div className="text-xs text-gray-500">نسخ ولصق</div>
                  </button>
                  <button
                    onClick={() => setInputType('file')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${inputType === 'file'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium">رفع ملف</div>
                    <div className="text-xs text-gray-500">PDF أو نص</div>
                  </button>
                </div>
              </div>

              {/* Text Input */}
              {inputType === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">النص المراد تحويله</label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="الصق النص أو البحث هنا..."
                  />
                </div>
              )}

              {/* File Upload */}
              {inputType === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">رفع الملف</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                      id="ai-file-upload"
                    />
                    <label htmlFor="ai-file-upload" className="cursor-pointer">
                      <div className="w-12 h-12 text-gray-400 mx-auto mb-3">📄</div>
                      <p className="text-lg font-medium text-gray-700 mb-1">
                        اختر ملف البحث أو النص
                      </p>
                      <p className="text-sm text-gray-500">
                        PDF, TXT حتى 10MB
                      </p>
                    </label>
                    {file && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-center">
                          <span className="text-green-700 font-medium">{file.name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex justify-end space-x-3 space-x-reverse pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAIModal(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={generateContent}
                  disabled={aiLoading || (inputType === 'file' && !file) || (inputType === 'text' && !textInput.trim())}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
                >
                  {aiLoading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin mr-2" />
                      جاري التوليد...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      توليد المحتوى
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;