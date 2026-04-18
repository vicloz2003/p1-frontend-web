# iBPMS Frontend Web — Manual de Arquitectura

**Angular 21 · Standalone · Signals · bpmn-js (Mapeado a UML)**
Fase actual: FRONTEND WEB (ibpms-frontend-web)
Backend API: http://localhost:3000/api/v1 (Referencia el proyecto `PoliticaNegocio` en este Workspace)

---

## 1. Stack Tecnológico
| Capa | Tecnología |
|---|---|
| Framework | Angular 21 (Zoneless + Standalone components) |
| UI | Angular Material (MDC) — Cero CSS manual |
| Editor diagramas | bpmn-js (BPMN 2.0) — Mapeado 1:1 a UML 2.5 |
| Formularios dinámicos | @ngx-formly/core + @ngx-formly/material |
| Estado Reactivo | Signals nativos (signal, computed, linkedSignal) |
| Peticiones HTTP | `httpResource()` (API nativa de Angular 21) |
| WebSocket | @stomp/stompjs + sockjs-client |

---

## 2. Reglas de Arquitectura — ¡CUMPLIR ESTRICTAMENTE!

* **Única Fuente de Verdad (Modelos):** NO inventes las interfaces. DEBES leer los DTOs de la carpeta `PoliticaNegocio` (Java) y generar las interfaces equivalentes en `src/app/core/models/`.
* **Mapeo BPMN a UML 2.5:** - StartEvent -> INITIAL_NODE
    - Task -> ACTION
    - Exclusive Gateway -> DECISION / MERGE
    - Parallel Gateway -> FORK / JOIN
    - End Event -> ACTIVITY_FINAL
    - Lane -> ActivityPartition
* **Separation of Concerns:** Componentes visuales puros. La lógica HTTP debe ir en servicios dentro de `src/app/core/services/`.
* **Zoneless & Control Flow:** Prohibido `Zone.js`. Usa el control de flujo nativo (`@if`, `@for`, `@switch`).
* **CERO CSS Manual:** Prohibido escribir estilos personalizados. Usa exclusivamente Angular Material.
* **Formularios Reactivos:** PROHIBIDO `ngModel`. Usa exclusivamente `ReactiveFormsModule`.
* **Autenticación:** - Guards funcionales: `CanActivateFn`.
    - Interceptors funcionales: `HttpInterceptorFn`.
    - Decodificación JWT local (JWT Payload: sub, role, departmentId, email, username).

---

## 3. Estructura de Carpetas Objetivo
```text
src/app/
├── core/
│   ├── auth/           # AuthService, JwtService, guards
│   ├── http/           # Interceptors funcionales
│   ├── websocket/      # WebSocketService (STOMP)
│   └── models/         # [Deducidos del backend Java]
├── features/
│   ├── auth/           # login, register
│   ├── designer/       # editor bpmn-js (ADMIN_DESIGNER)
│   ├── dashboard/      # panel empleado (EMPLOYEE)
│   ├── policies/       # gestión de políticas
│   └── processes/      # trazabilidad de procesos
├── shared/
│   ├── components/     # UI reusables
│   └── pipes/          # pipes puros
└── app.routes.ts       # Rutas con lazy loading