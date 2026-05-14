Agents Orchestrator — Opticolor Portal
Este repositorio de agentes constituye el "cerebro técnico" del portal administrativo de Opticolor. Cada archivo .md en esta carpeta define un experto especializado que Claude Code (Antigravity) debe personificar para garantizar que el sistema sea íntegro, rápido y fiel al diseño original.

📌 Protocolo de Acción Obligatorio
Todos los agentes definidos en esta carpeta operan bajo el OMNI-AGENT PROTOCOL. Antes de proponer cualquier cambio al código, Claude Code debe leer el agente correspondiente y seguir estas 6 etapas:
1. Identidad y Persona: Asumir el rol y tono específico.
2. Misión Crítica: Enfocarse en el objetivo principal del módulo.
3. Dominio y Alcance: Actuar solo dentro de los archivos permitidos.
4. Reglas de Oro e Invariables: Respetar las restricciones técnicas innegociables.
5. Protocolo de Interacción: Seguir el paso a paso de ejecución.
6. Checklist de Auditoría: Validar el trabajo antes de entregarlo.

📂 Fuentes de Verdad (Single Source of Truth)
Para evitar alucinaciones en nombres de campos o lógica de negocio, los agentes tienen la obligación de consultar:
- /docs/VISTAS.csv: Única fuente válida para nombres de columnas y esquemas SQL.
- Lógica DAX: Definiciones de medidas de Power BI proporcionadas por el usuario para asegurar la paridad lógica.
- Guía de Estilo: Paleta Premium Monocromática (Aqua Blue / Pearl Gray) y altura estándar de gráficos (h-[500px]).

🛠️ Inventario de Agentes
| Archivo | Agente | Especialidad |
| :--- | :--- | :--- |
| archidata-flow.md | ArchiData-Flow | Arquitectura de Software, Joins SQL y Estructura Next.js. |
| visionary-ui.md | Visionary-UI | Diseño UX/UI Responsive y Consistencia Estética. |
| cleancode-architect.md | CleanCode-Architect | Refactorización, Modularización y Deuda Técnica. |
| velocity-optimizer.md | Velocity-Optimizer | Latencia, Timeouts y Optimización de Queries. |
| secureguard-shield.md | SecureGuard-Shield | Ciberseguridad, Pentest y Sanitización de Datos. |
| logicaudit-pro.md | LogicAudit-Pro | Paridad Lógica (DAX a SQL) y Auditoría de QA. |
| datascribe-lexicon.md | DataScribe-Lexicon | Documentación y Diccionario de Datos. |

🚀 Cómo activar un agente
Para invocar la inteligencia de un especialista, menciona su archivo en tu instrucción a Claude Code:
"Claude, actúa como el agente en agents/archidata-flow.md para revisar la nueva vista de inventario..."
"Claude, usa el protocolo de agents/visionary-ui.md para ajustar la responsividad de las tablas..."

Desarrollado por VisioFlow Tech 
Propiedad Intelectual de Opticolor — 2026