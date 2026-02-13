import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ArticleCard from './ArticleCard';
import { useArticles } from '../../hooks/useArticles';
import { Search, Filter, X, Loader, FileText } from 'lucide-react';

interface ArticleListProps {
  tag?: string;
  limit?: number;
  showFilters?: boolean;
}

const ArticleList: React.FC<ArticleListProps> = ({ tag, limit = 12, showFilters = true }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(tag ? [tag] : []);
  const [showTagFilter, setShowTagFilter] = useState(false);

  const queryParams = useMemo(() => {
    const params: any = { limit };
    if (selectedTags.length > 0) params.tag = selectedTags[0];
    if (searchTerm) params.search = searchTerm;
    return params;
  }, [limit, selectedTags, searchTerm]);

  const { data: response, isLoading: loading } = useArticles(queryParams);

  const articles = useMemo(() => {
    const raw = response?.data || response;
    return Array.isArray(raw) ? raw : [];
  }, [response]);
  const totalResults = response?.pagination?.total || articles.length;

  const availableTags = useMemo(() => {
    if (articles.length > 0) {
      const allTags: string[] = [];
      articles.forEach((article: any) => {
        if (Array.isArray(article.tags)) {
          article.tags.forEach((tag: any) => {
            if (typeof tag === 'string') {
              allTags.push(tag);
            }
          });
        }
      });
      return [...new Set(allTags)];
    }
    return [];
  }, [articles]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) {
      params.set('search', searchTerm);
    }
    if (selectedTags.length > 0) {
      params.set('tag', selectedTags[0]);
    }
    setSearchParams(params);
  }, [searchTerm, selectedTags, setSearchParams]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [tagName]
    );
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setSearchParams({});
  };

  const toggleTagFilter = () => {
    setShowTagFilter(!showTagFilter);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        {showFilters && (
          <div className="form-modern">
            <div className="skeleton h-12 rounded-xl"></div>
          </div>
        )}
        <div className="grid-modern">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-white rounded-2xl overflow-hidden card-shadow">
              <div className="skeleton h-56"></div>
              <div className="p-6 space-y-4">
                <div className="skeleton h-4 w-1/4"></div>
                <div className="skeleton h-6 w-3/4"></div>
                <div className="skeleton h-4 w-full"></div>
                <div className="skeleton h-4 w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showFilters && (
        <div className="form-modern">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="ابحث عن مقالات..."
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
                onClick={toggleTagFilter}
                className={`btn-secondary inline-flex items-center ${showTagFilter ? 'bg-blue-50 border-blue-300 text-blue-700' : ''
                  }`}
              >
                <Filter size={18} className="ml-2" />
                تصفية
              </button>

              {(searchTerm || selectedTags.length > 0) && (
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
          {(searchTerm || selectedTags.length > 0) && (
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
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="badge-modern badge-success inline-flex items-center"
                >
                  الموضوع: {tag}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="mr-2 text-green-600 hover:text-green-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag filter */}
          {showTagFilter && availableTags.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl animate-slideIn">
              <h4 className="label-modern mb-3">تصفية حسب الموضوع:</h4>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tagName) => (
                  <button
                    key={tagName}
                    onClick={() => toggleTag(tagName)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-modern ${selectedTags.includes(tagName)
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                      }`}
                  >
                    {tagName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results counter */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {loading ? (
                <div className="flex items-center">
                  <Loader className="animate-spin ml-2 w-4 h-4" />
                  جاري البحث...
                </div>
              ) : (
                `تم العثور على ${totalResults} مقال`
              )}
            </div>
          </div>
        </div>
      )}

      {/* Articles Grid */}
      {articles.length === 0 && !loading ? (
        <div className="text-center py-16 bg-white rounded-3xl card-shadow">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد مقالات</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {searchTerm || selectedTags.length > 0
              ? 'لم نتمكن من العثور على مقالات تطابق معايير البحث. جرب كلمات مختلفة أو امسح المرشحات.'
              : 'لا توجد مقالات متاحة حالياً.'
            }
          </p>
          {(searchTerm || selectedTags.length > 0) && (
            <button
              onClick={clearSearch}
              className="btn-primary"
            >
              مسح المرشحات
            </button>
          )}
        </div>
      ) : (
        <div className="grid-modern">
          {articles.map((article: any, index: number) => (
            <div key={article.id} style={{ animationDelay: `${index * 0.1}s` }}>
              <ArticleCard article={article} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArticleList;