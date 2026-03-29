// ─── CONTACT CTA BAR ─────────────────────────────────────────────────────────
import { useState, useEffect } from "react";

export function ContactBar({ lang }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('cta-dismissed')) return;
    const timer = setTimeout(() => setShow(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after 5 seconds of being visible
  useEffect(() => {
    if (!show || dismissed) return;
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => { setDismissed(true); sessionStorage.setItem('cta-dismissed', '1'); }, 500);
    }, 5000);
    return () => clearTimeout(timer);
  }, [show, dismissed]);

  if (dismissed || !show) return null;
  const dismiss = () => { setFading(true); setTimeout(() => { setDismissed(true); sessionStorage.setItem('cta-dismissed', '1'); }, 300); };
  const isEN = lang === 'en';
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(99,102,241,0.2)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', animation: fading ? 'none' : 'slideUpCTA 0.4s ease', fontFamily: "'DM Sans', sans-serif", opacity: fading ? 0 : 1, transition: 'opacity 0.5s ease' }}>
      <style>{`@keyframes slideUpCTA { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>{isEN ? "This is a free demo by Impulso IA. Want something like this for your business?" : "Esto es una demo gratuita de Impulso IA. ¿Quieres algo asi para tu negocio?"}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="https://impulso-ia-navy.vercel.app/#contacto" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'transform 0.2s' }}>{isEN ? "Let's talk" : "Platiquemos"}</a>
        <a href="https://wa.me/525579605324?text=Hola%20Christian%2C%20me%20interesa%20saber%20m%C3%A1s%20sobre%20tus%20servicios%20de%20IA" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>WhatsApp</a>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>&#10005;</button>
      </div>
    </div>
  );
}
