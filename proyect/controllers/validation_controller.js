export class ValidationController {
  constructor() {}

  init() {
    // Placeholder enriquecido: en futuro, cargar desde JSON
    const examples = [
      { title: 'Foto/nota 1', text: 'Orilla expuesta cerca de Isla Esteves, Feb 2024.' },
      { title: 'Foto/nota 2', text: 'Área de totorales con suelo seco, Mar 2024.' },
      { title: 'Foto/nota 3', text: 'Descenso del nivel observado en muelle Puno, Abr 2024.' },
    ];
    const cards = document.querySelectorAll('.validation-card');
    cards.forEach((c, i) => {
      const ex = examples[i % examples.length];
      c.innerHTML = `<div><strong>${ex.title}</strong><p>${ex.text}</p></div>`;
    });
  }
}