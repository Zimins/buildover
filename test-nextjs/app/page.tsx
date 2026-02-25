'use client';

import MagnetLines from './components/MagnetLines';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">

      {/* Keyframe animations */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-22px) rotate(8deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(-10deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-12px) scale(1.08); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-28px) rotate(5deg); }
        }
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse-ring {
          0% { r: 6; opacity: 1; }
          100% { r: 18; opacity: 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes draw-line {
          0% { stroke-dashoffset: 200; opacity: 0.2; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.2; }
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 0.5; r: 5; }
          50% { opacity: 1; r: 8; }
        }
        .bounce-char {
          display: inline-block;
        }
        .float-1 { animation: float1 5s ease-in-out infinite; }
        .float-2 { animation: float2 6.5s ease-in-out infinite; }
        .float-3 { animation: float3 4.5s ease-in-out infinite; }
        .float-slow { animation: floatSlow 8s ease-in-out infinite; }
        .spin-slow { animation: spin-slow 18s linear infinite; transform-origin: center; }
        .spin-reverse { animation: spin-reverse 12s linear infinite; transform-origin: center; }
      `}</style>

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
      <section className="relative overflow-hidden pt-40 pb-28 px-6 bg-gradient-to-br from-orange-50 via-white to-amber-50 text-center">

        {/* MagnetLines 배경 */}
        <div className="pointer-events-auto absolute inset-0 w-full h-full">
          <MagnetLines
            rows={14}
            columns={22}
            lineColor="rgba(251,146,60,0.45)"
            lineWidth="1.5px"
            lineHeight="36px"
            baseAngle={-10}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Hero 텍스트 */}
        <div className="relative z-10">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-4">Leading Innovation Forward</p>
          <h1 className="text-6xl md:text-8xl font-extrabold leading-tight text-gray-900 mb-6">
            Building the Future
            <br />
            <span className="text-orange-500">Together</span>
          </h1>
          <p className="max-w-xl mx-auto text-lg text-gray-500 mb-10">
            NexusCorp empowers your business to the next level with AI, Cloud,
            and Digital Transformation solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#services"
              className="rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white hover:bg-orange-600 transition-colors shadow-lg"
            >
              Explore Services
            </a>
            <a
              href="#contact"
              className="rounded-full border border-orange-300 px-8 py-3 text-base font-semibold text-orange-500 hover:bg-orange-50 transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-3">About Us</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-5">15년의 신뢰,<br />끊임없는 혁신</h2>
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

          {/* About SVG 애니메이션 — 네트워크 노드 */}
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 340 300" className="w-full max-w-sm" xmlns="http://www.w3.org/2000/svg">

              {/* 연결선 */}
              {[
                { x1: 170, y1: 60,  x2: 60,  y2: 160, delay: "0s" },
                { x1: 170, y1: 60,  x2: 170, y2: 170, delay: "0.4s" },
                { x1: 170, y1: 60,  x2: 280, y2: 160, delay: "0.8s" },
                { x1: 60,  y1: 160, x2: 170, y2: 170, delay: "1.2s" },
                { x1: 280, y1: 160, x2: 170, y2: 170, delay: "1.6s" },
                { x1: 60,  y1: 160, x2: 100, y2: 255, delay: "2s"   },
                { x1: 170, y1: 170, x2: 240, y2: 255, delay: "2.4s" },
                { x1: 280, y1: 160, x2: 240, y2: 255, delay: "2.8s" },
              ].map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0.3"
                  strokeDasharray="200" strokeDashoffset="200">
                  <animate attributeName="stroke-dashoffset" from="200" to="0"
                    dur="1.5s" begin={l.delay} repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.3;0.7;0.3"
                    dur="3s" begin={l.delay} repeatCount="indefinite" />
                </line>
              ))}

              {/* 노드 */}
              {[
                { cx: 170, cy: 60,  r: 18, delay: "0s",   label: "AI" },
                { cx: 60,  cy: 160, r: 14, delay: "0.5s", label: "Cloud" },
                { cx: 280, cy: 160, r: 14, delay: "1s",   label: "Data" },
                { cx: 170, cy: 170, r: 16, delay: "1.5s", label: "Core" },
                { cx: 100, cy: 255, r: 12, delay: "2s",   label: "Sec" },
                { cx: 240, cy: 255, r: 12, delay: "2.5s", label: "Dev" },
              ].map((n, i) => (
                <g key={i}>
                  {/* 펄스 링 */}
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0">
                    <animate attributeName="r" values={`${n.r};${n.r + 14};${n.r + 14}`}
                      dur="2.5s" begin={n.delay} repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.6;0;0"
                      dur="2.5s" begin={n.delay} repeatCount="indefinite" />
                  </circle>
                  {/* 채워진 원 */}
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill="#fff7ed" stroke="#fb923c" strokeWidth="2">
                    <animate attributeName="r" values={`${n.r};${n.r + 2};${n.r}`}
                      dur="2.5s" begin={n.delay} repeatCount="indefinite" />
                  </circle>
                  {/* 라벨 */}
                  <text x={n.cx} y={n.cy + 4} textAnchor="middle"
                    fontSize="8" fontWeight="700" fill="#ea580c" fontFamily="sans-serif">
                    {n.label}
                  </text>
                </g>
              ))}

              {/* 중앙 이동 패킷 (작은 원이 선 위를 이동) */}
              {[
                { x1: 170, y1: 60,  x2: 60,  y2: 160, dur: "2s",   begin: "0.3s" },
                { x1: 170, y1: 60,  x2: 280, y2: 160, dur: "2.2s", begin: "1s"   },
                { x1: 170, y1: 170, x2: 240, y2: 255, dur: "1.8s", begin: "1.8s" },
              ].map((p, i) => (
                <circle key={i} r="4" fill="#f97316" fillOpacity="0.8">
                  <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite">
                    <mpath href={`#path-${i}`} />
                  </animateMotion>
                </circle>
              ))}
              <path id="path-0" d="M170,60 L60,160" fill="none" />
              <path id="path-1" d="M170,60 L280,160" fill="none" />
              <path id="path-2" d="M170,170 L240,255" fill="none" />

            </svg>
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
              { icon: "🤖", title: "AI 솔루션", desc: "머신러닝 및 생성형 AI 기술을 활용해 업무 자동화와 의사결정 고도화를 실현합니다." },
              { icon: "☁️", title: "클라우드 전환", desc: "안전하고 확장 가능한 클라우드 인프라 구축으로 비용 절감과 운영 효율성을 동시에 달성합니다." },
              { icon: "📊", title: "데이터 분석", desc: "실시간 데이터 파이프라인과 BI 대시보드로 비즈니스 인사이트를 즉시 확인하세요." },
              { icon: "🔒", title: "사이버 보안", desc: "최신 위협 인텔리전스와 제로트러스트 아키텍처로 기업 자산을 안전하게 보호합니다." },
              { icon: "📱", title: "모바일 & 웹 개발", desc: "사용자 경험 중심의 반응형 웹 및 네이티브 앱을 빠르고 정확하게 구현합니다." },
              { icon: "🔗", title: "시스템 통합", desc: "ERP·CRM·레거시 시스템을 원활하게 연결하여 데이터 사일로를 해소합니다." },
            ].map((service) => (
              <div key={service.title} className="rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-sm text-gray-500 leading-7">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-24 px-6 bg-blue-500 text-white text-center">
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
                <div className="text-blue-100 text-sm font-medium">{stat.label}</div>
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
          <input type="text" placeholder="이름" required
            className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <input type="email" placeholder="이메일" required
            className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <textarea placeholder="문의 내용" rows={4} required
            className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          <button type="submit"
            className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors shadow-lg">
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
