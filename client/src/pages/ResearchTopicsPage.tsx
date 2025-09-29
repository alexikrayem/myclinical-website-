import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Search, Filter, X, Loader, BookOpen, Award, Users } from 'lucide-react';
import ResearchCard from '../components/research/ResearchCard';
import { researchApi } from '../lib/api';

const ResearchTopicsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [researches, setResearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedJournals, setSelectedJournals] = useState<string[]>([]);
  const [availableJournals, setAvailableJournals] = useState<string[]>([]);
  const [showJournalFilter, setShowJournalFilter] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    const fetchResearches = async () => {
      try {
        setLoading(true);
        
        const params: any = {};
        
        if (selectedJournals.length > 0) {
          params.journal = selectedJournals[0];
        }
        
        if (searchTerm) {
          params.search = searchTerm;
        }

        const response = await researchApi.getAll(params);
        const researchData = response.data || response || [];
        setResearches(researchData);
        setTotalResults(response.pagination?.total || researchData.length);

        // Fetch available journals
        try {
          const journals = await researchApi.getJournals();
          setAvailableJournals(journals || []);
        } catch (error) {
          console.error('Error fetching journals:', error);
        }
      } catch (error) {
        console.error('Error fetching researches:', error);
        setResearches([]);
        setTotalResults(0);
      } finally {
        setLoading(false);
      }
    };

    fetchResearches();
  }, [searchTerm, selectedJournals]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) {
      params.set('search', searchTerm);
    }
    if (selectedJournals.length > 0) {
      params.set('journal', selectedJournals[0]);
    }
    setSearchParams(params);
  }, [searchTerm, selectedJournals, setSearchParams]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const toggleJournal = (journal: string) => {
    setSelectedJournals(prev => 
      prev.includes(journal) 
        ? prev.filter(j => j !== journal) 
        : [journal]
    );
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedJournals([]);
    setSearchParams({});
  };

  const toggleJournalFilter = () => {
    setShowJournalFilter(!showJournalFilter);
  };

  return (
    <div className="layout-modern py-12">
      <div className="container-modern">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center bg-purple-100 text-purple-800 rounded-full px-4 py-2 mb-6">
            <BookOpen className="w-4 h-4 ml-2" />
            <span className="text-sm font-medium">الأبحاث العلمية</span>
          </div>
          
          <h1 className="heading-modern text-4xl lg:text-5xl text-gray-900 mb-4">
            مكتبة الأبحاث العلمية
          </h1>
          
          <p className="text-modern text-lg max-w-3xl mx-auto">
            استكشف أحدث الأبحاث والدراسات العلمية في مجال طب الأسنان من أشهر المجلات والدوريات العلمية المحكمة
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="form-modern text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{totalResults}</div>
            <p className="text-gray-600">بحث علمي</p>
          </div>
          
          <div className="form-modern text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{availableJournals.length}</div>
            <p className="text-gray-600">مجلة علمية</p>
          </div>
          
          <div className="form-modern text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">200+</div>
            <p className="text-gray-600">باحث ومؤلف</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="form-modern mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="ابحث في الأبحاث العلمية..."
                className="input-modern pr-12"
                value={searchTerm}
                onChange={handleSearchInputChange}
              />
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={toggleJournalFilter}
                className={`btn-secondary inline-flex items-center ${
                  showJournalFilter ? 'bg-blue-50 border-blue-300 text-blue-700' : ''
                }`}
              >
                <Filter size={18} className="ml-2" />
                تصفية حسب المجلة
              </button>
              
              {(searchTerm || selectedJournals.length > 0) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="btn-secondary inline-flex items-center text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X size={18} className="ml-2" />
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Active filters */}
          {(searchTerm || selectedJournals.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2 animate-fadeIn">
              {searchTerm && (
                <span className="badge-modern badge-primary inline-flex items-center">
                  البحث: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="mr-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
              {selectedJournals.map((journal) => (
                <span
                  key={journal}
                  className="badge-modern badge-success inline-flex items-center"
                >
                  المجلة: {journal}
                  <button
                    onClick={() => toggleJournal(journal)}
                    className="mr-2 text-green-600 hover:text-green-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Journal filter */}
          {showJournalFilter && availableJournals.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl animate-slideIn">
              <h4 className="label-modern mb-3">تصفية حسب المجلة:</h4>
              <div className="flex flex-wrap gap-2">
                {availableJournals.map((journal) => (
                  <button
                    key={journal}
                    onClick={() => toggleJournal(journal)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-modern ${
                      selectedJournals.includes(journal)
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                    }`}
                  >
                    {journal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results counter */}
          <div className="mt-4 text-sm text-gray-600">
            {loading ? (
              <div className="flex items-center">
                <Loader className="animate-spin ml-2 w-4 h-4" />
                جاري البحث...
              </div>
            ) : (
              `تم العثور على ${totalResults} بحث علمي`
            )}
          </div>
        </div>

        {/* Research List */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden card-shadow">
                <div className="p-6 space-y-4">
                  <div className="skeleton h-6 w-3/4"></div>
                  <div className="skeleton h-4 w-1/4"></div>
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-full"></div>
                    <div className="skeleton h-4 w-full"></div>
                    <div className="skeleton h-4 w-2/3"></div>
                  </div>
                  <div className="skeleton h-4 w-1/2"></div>
                  <div className="skeleton h-8 w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : researches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl card-shadow">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد أبحاث متطابقة</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {searchTerm || selectedJournals.length > 0 
                ? 'لم نتمكن من العثور على أبحاث تطابق معايير البحث. جرب كلمات مختلفة أو امسح المرشحات.'
                : 'لا توجد أبحاث متاحة حالياً.'
              }
            </p>
            {(searchTerm || selectedJournals.length > 0) && (
              <button
                onClick={clearSearch}
                className="btn-primary"
              >
                مسح المرشحات
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {researches.map((research, index) => (
              <div key={research.id} style={{ animationDelay: `${index * 0.1}s` }}>
                <ResearchCard research={research} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchTopicsPage;