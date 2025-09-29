import React, { useState, useEffect } from 'react';
import { User, MapPin, GraduationCap, Calendar, Award, Mail, Globe } from 'lucide-react';
import { authorsApi } from '../../lib/api';

interface AuthorCardProps {
  authorName: string;
  className?: string;
}

interface AuthorInfo {
  name: string;
  bio: string;
  image: string;
  specialization: string;
  experience_years: number;
  education: string;
  location: string;
  email?: string;
  website?: string;
}

const AuthorCard: React.FC<AuthorCardProps> = ({ authorName, className = '' }) => {
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        setLoading(true);
        const authorData = await authorsApi.getByName(authorName);
        setAuthor(authorData);
      } catch (error) {
        console.error('Error fetching author:', error);
        // Set default author info
        setAuthor({
          name: authorName,
          bio: 'طبيب أسنان متخصص ومؤلف في مجال طب الأسنان مع خبرة واسعة في التشخيص والعلاج. يهتم بتطوير المعرفة الطبية ونشر الوعي الصحي في المجتمع العربي.',
          image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
          specialization: 'طب الأسنان العام',
          experience_years: 8,
          education: 'بكالوريوس طب وجراحة الأسنان، ماجستير في طب الأسنان التخصصي',
          location: 'المملكة العربية السعودية'
        });
      } finally {
        setLoading(false);
      }
    };

    if (authorName) {
      fetchAuthor();
    }
  }, [authorName]);

  if (loading) {
    return (
      <div className={`form-modern ${className}`}>
        <div className="flex items-start space-x-6 space-x-reverse">
          <div className="skeleton w-24 h-24 rounded-2xl"></div>
          <div className="flex-1 space-y-3">
            <div className="skeleton h-6 w-1/2"></div>
            <div className="skeleton h-4 w-1/3"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!author) {
    return null;
  }

  return (
    <div className={`form-modern border-r-4 border-blue-500 ${className}`}>
      <div className="flex items-start space-x-6 space-x-reverse">
        <div className="relative">
          <img
            src={author.image}
            alt={author.name}
            className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg"
          />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <Award size={16} className="text-white" />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900 mb-1">{author.name}</h3>
            <p className="text-blue-600 font-semibold mb-2">{author.specialization}</p>
            <p className="text-gray-600 leading-relaxed">{author.bio}</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center text-gray-500">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center ml-3">
                <GraduationCap size={16} className="text-blue-600" />
              </div>
              <span>{author.education}</span>
            </div>
            
            <div className="flex items-center text-gray-500">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center ml-3">
                <Calendar size={16} className="text-green-600" />
              </div>
              <span>{author.experience_years} سنوات خبرة</span>
            </div>
            
            <div className="flex items-center text-gray-500">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center ml-3">
                <MapPin size={16} className="text-purple-600" />
              </div>
              <span>{author.location}</span>
            </div>
            
            {author.email && (
              <div className="flex items-center text-gray-500">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center ml-3">
                  <Mail size={16} className="text-orange-600" />
                </div>
                <a href={`mailto:${author.email}`} className="hover:text-blue-600 transition-colors">
                  {author.email}
                </a>
              </div>
            )}
            
            {author.website && (
              <div className="flex items-center text-gray-500 lg:col-span-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center ml-3">
                  <Globe size={16} className="text-indigo-600" />
                </div>
                <a 
                  href={author.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors"
                >
                  {author.website}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorCard;