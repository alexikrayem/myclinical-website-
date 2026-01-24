import React, { useEffect, useState } from 'react';
import { Search, Download, Shield, CheckCircle, XCircle } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { reportService, LicenseReport } from '../services/reportService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const LicenseReports: React.FC = () => {
    const [reports, setReports] = useState<LicenseReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const data = await reportService.getLicenseReport({
                search: searchQuery,
                page: pagination.page
            });
            setReports(data.data);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Failed to fetch reports');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchReports();
        }, 500);
        return () => clearTimeout(debounce);
    }, [searchQuery, pagination.page]);

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <Shield className="text-blue-600" />
                            تقارير الأكواد
                        </h1>
                        <p className="text-gray-500 mt-2">متابعة استخدام الأكواد ونتائج الاختبارات</p>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-medium">
                        {pagination.total} سجل
                    </div>
                </div>

                <div className="bg-white rounded-3xl card-shadow overflow-hidden border border-gray-100">
                    {/* Toolbar */}
                    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="بحث عن كود أو بريد إلكتروني..."
                                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <Download size={18} />
                            تصدير / طباعة
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm font-medium">
                                <tr>
                                    <th className="px-6 py-4">الكود</th>
                                    <th className="px-6 py-4">المستخدم</th>
                                    <th className="px-6 py-4">تاريخ التفعيل</th>
                                    <th className="px-6 py-4">الدورة</th>
                                    <th className="px-6 py-4">النتيجة</th>
                                    <th className="px-6 py-4">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            جاري التحميل...
                                        </td>
                                    </tr>
                                ) : reports.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            لا توجد بيانات
                                        </td>
                                    </tr>
                                ) : (
                                    reports.map((report, index) => (
                                        <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-blue-600 font-medium dir-ltr text-right">
                                                {report.code}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">
                                                {report.user_email}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">
                                                {report.redeemed_at ? format(new Date(report.redeemed_at), 'dd MMM yyyy', { locale: ar }) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 font-medium">
                                                {report.course_title || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {report.score !== null ? (
                                                    <span className="font-bold">{report.score}%</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {report.score !== null ? (
                                                    report.passed ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium">
                                                            <CheckCircle size={12} />
                                                            ناجح
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-medium">
                                                            <XCircle size={12} />
                                                            راسب
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-gray-400 text-xs">لم يختبر</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            السابق
                        </button>
                        <span className="text-gray-600">
                            صفحة {pagination.page} من {pagination.pages}
                        </span>
                        <button
                            disabled={pagination.page === pagination.pages}
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            التالي
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default LicenseReports;
