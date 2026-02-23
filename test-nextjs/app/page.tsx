'use client';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight text-orange-500">Nexus<span className="text-gray-800">Corp</span></span>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-600">
            <a href="#about" className="hover:text-orange-500 transition-colors">회사 소개</a>
            <a href="#services" className="hover:text-orange-500 transition-colors">서비스</a>
            <a href="#stats" className="hover:text-orange-500 transition-colors">실적</a>
            <a href="#contact" className="hover:text-orange-500 transition-colors">문의</a>
          </nav>
          <a
            href="#contact"
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            무료 상담
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-28 px-6 bg-gradient-to-br from-orange-50 via-white to-amber-50 text-center">
        <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-4">혁신을 선도하는 기업</p>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight text-gray-900 mb-6">
          미래를 함께<br />
          <span className="text-orange-500">만들어 갑니다</span>
        </h1>
        <p className="max-w-xl mx-auto text-lg text-gray-500 mb-10">
          NexusCorp는 AI·클라우드·디지털 트랜스포메이션 솔루션으로
          고객의 비즈니스를 한 단계 성장시킵니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#services"
            className="rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white hover:bg-orange-600 transition-colors shadow-lg"
          >
            서비스 알아보기
          </a>
          <a
            href="#contact"
            className="rounded-full border border-orange-300 px-8 py-3 text-base font-semibold text-orange-500 hover:bg-orange-50 transition-colors"
          >
            문의하기
          </a>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-3">About Us</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-5">10년의 신뢰,<br />끊임없는 혁신</h2>
            <p className="text-gray-500 leading-8 mb-6">
              2014년 설립 이후 NexusCorp는 국내외 300개 이상의 기업과 파트너십을 맺으며
              기술 혁신의 중심에서 성장해 왔습니다. 우리는 단순한 솔루션 제공을 넘어,
              고객의 비즈니스 목표를 함께 설계하고 실현합니다.
            </p>
            <ul className="space-y-3 text-gray-600 text-sm">
              {["고객 중심의 맞춤형 솔루션", "글로벌 수준의 기술력", "24/7 전담 지원 체계"].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-xs font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { emoji: "🏢", label: "본사", value: "서울 강남구" },
              { emoji: "👥", label: "임직원", value: "450 +" },
              { emoji: "🌏", label: "글로벌 거점", value: "12개국" },
              { emoji: "🏆", label: "수상 실적", value: "35개 이상" },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl bg-orange-50 p-6 text-center">
                <div className="text-3xl mb-2">{card.emoji}</div>
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className="text-xl font-bold text-gray-800">{card.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-3">Services</p>
            <h2 className="text-4xl font-bold text-gray-900">핵심 서비스</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🤖",
                title: "AI 솔루션",
                desc: "머신러닝 및 생성형 AI 기술을 활용해 업무 자동화와 의사결정 고도화를 실현합니다.",
              },
              {
                icon: "☁️",
                title: "클라우드 전환",
                desc: "안전하고 확장 가능한 클라우드 인프라 구축으로 비용 절감과 운영 효율성을 동시에 달성합니다.",
              },
              {
                icon: "📊",
                title: "데이터 분석",
                desc: "실시간 데이터 파이프라인과 BI 대시보드로 비즈니스 인사이트를 즉시 확인하세요.",
              },
              {
                icon: "🔒",
                title: "사이버 보안",
                desc: "최신 위협 인텔리전스와 제로트러스트 아키텍처로 기업 자산을 안전하게 보호합니다.",
              },
              {
                icon: "📱",
                title: "모바일 & 웹 개발",
                desc: "사용자 경험 중심의 반응형 웹 및 네이티브 앱을 빠르고 정확하게 구현합니다.",
              },
              {
                icon: "🔗",
                title: "시스템 통합",
                desc: "ERP·CRM·레거시 시스템을 원활하게 연결하여 데이터 사일로를 해소합니다.",
              },
            ].map((service) => (
              <div
                key={service.title}
                className="rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-sm text-gray-500 leading-7">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-24 px-6 bg-orange-500 text-white text-center">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold mb-14">숫자로 보는 NexusCorp</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { value: "300+", label: "고객사" },
              { value: "98%", label: "고객 만족도" },
              { value: "10년", label: "업계 경험" },
              { value: "24/7", label: "고객 지원" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-5xl font-extrabold mb-2">{stat.value}</div>
                <div className="text-orange-100 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6 max-w-2xl mx-auto text-center">
        <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-3">Contact</p>
        <h2 className="text-4xl font-bold text-gray-900 mb-4">함께 시작해볼까요?</h2>
        <p className="text-gray-500 mb-10">
          프로젝트 문의, 파트너십, 채용 등 어떤 것이든 편하게 연락 주세요.
        </p>
        <form className="flex flex-col gap-4 text-left" onSubmit={(e) => { e.preventDefault(); alert('문의가 접수되었습니다! 빠르게 연락 드리겠습니다 😊'); }}>
          <input
            type="text"
            placeholder="이름"
            required
            className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="email"
            placeholder="이메일"
            required
            className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <textarea
            placeholder="문의 내용"
            rows={4}
            required
            className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors shadow-lg"
          >
            문의 보내기
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 px-6 text-center text-sm text-gray-400">
        <p className="font-semibold text-orange-500 mb-1">NexusCorp</p>
        <p>서울특별시 강남구 테헤란로 123 넥서스빌딩 15F</p>
        <p className="mt-1">contact@nexuscorp.kr · 02-1234-5678</p>
        <p className="mt-4">© 2024 NexusCorp. All rights reserved.</p>
      </footer>

    </div>
  );
}
