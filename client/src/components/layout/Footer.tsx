import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Youtube, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="footer-modern text-white">
      <div className="container-modern">
        <div className="section-modern">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <div className="lg:col-span-2">
              {/* Logo Container - holds the logo with a fixed "bar" height */}
              {/* ADDED transition-all duration-300 ease-in-out here */}
              {/* Logo Container */}
              <div className="mb-6">
                <Link to="/" className="inline-flex items-center gap-1.5 bg-white p-4 rounded-2xl shadow-lg group transition-transform duration-300 hover:-translate-y-1">
                  <img
                    src="/logo.png"
                    alt="Tabeeb Logo"
                    className="h-14 w-auto drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="flex flex-col items-start justify-center -space-y-0.5 pt-1">
                    <span className="text-[24px] font-bold text-gray-900 leading-none" style={{ fontFamily: "'MontserratArabic', sans-serif" }}>
                      طبيب
                    </span>
                    <span className="text-[24px] font-bold text-gray-900 leading-none tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      Tabeeb
                    </span>
                  </div>
                </Link>
              </div>

              <p className="text-gray-300 mb-6 leading-relaxed text-lg max-w-md">
                منصة رائدة في مجال طب الأسنان العربي، نقدم أحدث المقالات والأبحاث العلمية للمتخصصين والمهتمين بصحة الفم والأسنان.
              </p>

              <div className="flex space-x-4 space-x-reverse">
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <Facebook size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <Twitter size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <Instagram size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <Youtube size={20} />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-6">روابط سريعة</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/" className="text-gray-300 hover:text-white transition-colors flex items-center">
                    <span>الرئيسية</span>
                  </Link>
                </li>
                <li>
                  <Link to="/articles" className="text-gray-300 hover:text-white transition-colors">
                    المقالات
                  </Link>
                </li>
                <li>
                  <Link to="/research-topics" className="text-gray-300 hover:text-white transition-colors">
                    أبحاث علمية
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-gray-300 hover:text-white transition-colors">
                    من نحن
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-gray-300 hover:text-white transition-colors">
                    اتصل بنا
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-6">تواصل معنا</h3>
              <ul className="space-y-4">
                <li className="flex items-center text-gray-300">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center ml-3">
                    <Phone size={18} />
                  </div>
                  <span>+966 12 345 6789</span>
                </li>
                <li className="flex items-center text-gray-300">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center ml-3">
                    <Mail size={18} />
                  </div>
                  <span>info@arabdental.com</span>
                </li>
                <li className="flex items-start text-gray-300">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center ml-3 mt-1">
                    <MapPin size={18} />
                  </div>
                  <span className="leading-relaxed">
                    الرياض، المملكة العربية السعودية
                    <br />
                    طريق الملك فهد، برج المملكة
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8 pb-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-400">
            <p className="flex items-center">
              &copy; {new Date().getFullYear()} طب الأسنان العربي. جميع الحقوق محفوظة.
              <Heart size={16} className="mx-2 text-red-400" />
              صُنع بحب في المملكة العربية السعودية
            </p>
            <div className="flex space-x-6 space-x-reverse mt-4 md:mt-0">
              <Link to="/privacy" className="hover:text-white transition-colors">سياسة الخصوصية</Link>
              <Link to="/terms" className="hover:text-white transition-colors">شروط الاستخدام</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;