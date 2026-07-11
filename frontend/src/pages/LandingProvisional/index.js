import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import logo from "../../assets/daple-logo.png";

// Landing page PROVISORIA - substitui temporariamente a landing completa
// (pages/Landing) durante o processo de aprovacao do DAPLE junto a Meta.
// Nao expoe modulos extras, precos/valores ou funcionalidades fora do
// plano basico, para nao comprometer a avaliacao. A landing original
// permanece intacta em pages/Landing e volta a ser usada apos a aprovacao
// (so trocar o componente da rota "/daple" em routes/index.js).
const css = `
  .lp-provisional *, .lp-provisional *::before, .lp-provisional *::after {
    box-sizing: border-box;
  }
  .lp-provisional {
    background: #0A0A0A;
    color: #F5F5F5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .lp-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid rgba(245,194,0,0.15);
  }
  .lp-nav img { height: 44px; object-fit: contain; }
  .lp-nav a {
    color: #0A0A0A;
    background: #F5C200;
    padding: 10px 22px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 700;
    font-size: 14px;
    transition: opacity 0.15s;
  }
  .lp-nav a:hover { opacity: 0.85; }
  .lp-hero {
    text-align: center;
    padding: 72px 24px 48px;
    max-width: 720px;
    margin: 0 auto;
  }
  .lp-hero h1 {
    font-size: 40px;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 16px;
  }
  .lp-hero h1 span { color: #F5C200; }
  .lp-hero p {
    font-size: 17px;
    color: #B3B3B3;
    line-height: 1.6;
  }
  .lp-banner {
    max-width: 640px;
    margin: 32px auto 0;
    background: rgba(245,194,0,0.08);
    border: 1px solid rgba(245,194,0,0.3);
    border-radius: 12px;
    padding: 20px 24px;
    text-align: center;
  }
  .lp-banner strong { color: #F5C200; }
  .lp-banner p { font-size: 14px; color: #E5E5E5; line-height: 1.6; margin: 0; }
  .lp-features {
    max-width: 960px;
    margin: 56px auto;
    padding: 0 24px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }
  .lp-feature {
    background: #141414;
    border: 1px solid #242424;
    border-radius: 12px;
    padding: 24px;
  }
  .lp-feature .icon { font-size: 26px; margin-bottom: 10px; }
  .lp-feature h3 { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
  .lp-feature p { font-size: 13px; color: #999; line-height: 1.5; }
  .lp-cta {
    text-align: center;
    padding: 40px 24px 72px;
  }
  .lp-cta a {
    display: inline-block;
    background: #F5C200;
    color: #0A0A0A;
    padding: 14px 32px;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 800;
    font-size: 15px;
  }
  .lp-footer {
    text-align: center;
    padding: 24px;
    color: #666;
    font-size: 12px;
    border-top: 1px solid #1C1C1C;
  }
`;

const features = [
  { icon: "💬", title: "Atendimento centralizado", desc: "Converse com seus clientes pelo WhatsApp direto de uma única tela." },
  { icon: "📥", title: "Filas de atendimento", desc: "Organize as conversas por setor e distribua entre os atendentes." },
  { icon: "👥", title: "Múltiplos atendentes", desc: "Sua equipe trabalha junto, sem perder o histórico da conversa." },
  { icon: "📌", title: "Kanban de atendimentos", desc: "Acompanhe o andamento de cada atendimento em um quadro visual." },
  { icon: "🗓️", title: "Agendamento de mensagens", desc: "Programe envios para o momento certo." },
  { icon: "📷", title: "Instagram e Facebook", desc: "Centralize também as mensagens recebidas nessas redes." },
];

const LandingProvisional = () => {
  const history = useHistory();

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap";
    document.head.appendChild(link);

    const styleEl = document.createElement("style");
    styleEl.id = "daple-landing-provisional-css";
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("daple-landing-provisional-css");
      if (el) el.remove();
    };
  }, []);

  return (
    <div className="lp-provisional">
      <nav className="lp-nav">
        <img src={logo} alt="DAPLE" />
        <a href="/login" onClick={(e) => { e.preventDefault(); history.push("/login"); }}>
          Entrar
        </a>
      </nav>

      <div className="lp-hero">
        <h1>Atendimento inteligente via <span>WhatsApp</span></h1>
        <p>
          O DAPLE centraliza o atendimento ao cliente da sua empresa em uma
          única plataforma, simples e eficiente.
        </p>

        <div className="lp-banner">
          <p>
            <strong>Disponível exclusivamente para clientes Pub Plus.</strong>
            <br />
            Em breve, o DAPLE será liberado com muito mais recursos.
          </p>
        </div>
      </div>

      <div className="lp-features">
        {features.map((f) => (
          <div className="lp-feature" key={f.title}>
            <div className="icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="lp-cta">
        <a href="/login" onClick={(e) => { e.preventDefault(); history.push("/login"); }}>
          Já sou cliente Pub Plus
        </a>
      </div>

      <div className="lp-footer">
        © {new Date().getFullYear()} DAPLE — Uma plataforma Pub Plus
      </div>
    </div>
  );
};

export default LandingProvisional;
