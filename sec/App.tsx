import React, { useState } from 'react';

type Language = 'ar' | 'fr' | 'en';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');

  const translations = {
    ar: {
      dir: 'rtl',
      title: 'CircuitFix - نظام إدارة صيانة الهواتف',
      dashboard: 'لوحة التحكم',
      intake: 'استلام جهاز',
      sales: 'المبيعات',
      inventory: 'المخزون والديون',
      workers: 'إدارة العمال',
      welcome: 'مرحباً بك في نظام CircuitFix الاحترافي',
    },
    fr: {
      dir: 'ltr',
      title: 'CircuitFix - Gestion d\'Atelier',
      dashboard: 'Tableau de bord',
      intake: 'Réception',
      sales: 'Ventes',
      inventory: 'Stock & Dettes',
      workers: 'Gestion Employés',
      welcome: 'Bienvenue sur votre système CircuitFix',
    },
    en: {
      dir: 'ltr',
      title: 'CircuitFix - Workshop Management System',
      dashboard: 'Dashboard',
      intake: 'Device Intake',
      sales: 'Sales',
      inventory: 'Inventory & Debts',
      workers: 'Manage Workers',
      welcome: 'Welcome to your CircuitFix System',
    },
  };

  const t = translations[lang];

  return (
    <div dir={t.dir} className="min-h-screen bg-[#0b0f19] text-white p-4 font-sans">
      {/* Navbar */}
      <header className="flex flex-wrap justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-6 shadow-lg">
        <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
          <i className="fa-solid font-bold fa-screwdriver-wrench"></i>
          {t.title}
        </h1>

        {/* Language Selector */}
        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setLang('ar')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
              lang === 'ar' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            العربية
          </button>
          <button
            onClick={() => setLang('fr')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
              lang === 'fr' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Français
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
              lang === 'en' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h2 className="text-lg font-semibold mb-2">{t.welcome}</h2>
          <p className="text-slate-400 text-sm">التطبيق جاهز ومتصل بالهيكلية الجديدة والنظيفة.</p>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-emerald-500/50 transition-all cursor-pointer">
            <i className="fa-solid fa-laptop-medical text-emerald-400 text-2xl mb-2"></i>
            <h3 className="font-semibold text-sm">{t.intake}</h3>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-emerald-500/50 transition-all cursor-pointer">
            <i className="fa-solid fa-cart-shopping text-emerald-400 text-2xl mb-2"></i>
            <h3 className="font-semibold text-sm">{t.sales}</h3>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-emerald-500/50 transition-all cursor-pointer">
            <i className="fa-solid fa-boxes-stacked text-emerald-400 text-2xl mb-2"></i>
            <h3 className="font-semibold text-sm">{t.inventory}</h3>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-emerald-500/50 transition-all cursor-pointer">
            <i className="fa-solid fa-users-gear text-emerald-400 text-2xl mb-2"></i>
            <h3 className="font-semibold text-sm">{t.workers}</h3>
          </div>
        </div>
      </main>
    </div>
  );
}
