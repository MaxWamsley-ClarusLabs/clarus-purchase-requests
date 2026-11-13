
Clarus web-app design summary
Reference implementation: KFA-MDA Linear Region Analyzer (clra-single_gui_v1/web_app/). Use this document to build a new app with the same look, layout and interaction patterns.

1. Stack
Layer	Choice	Notes
Framework	Python 3.12 + NiceGUI 3.x (Quasar/Vue under the hood)	Single-process local web app, served on 127.0.0.1, browser auto-opens
Plots	Plotly via ui.plotly	Themed with the same palette (see section 5)
Styling	One theme.py module returning a CSS string, injected once with ui.add_css(theme.css())	No Tailwind config; NiceGUI utility classes (w-full, items-center) plus custom classes
Fonts	Inter, fallback "Segoe UI", Arial	Monospace log: Consolas / Cascadia Mono
Icons/brand	.ico served from a /reference static folder	Favicon and sidebar logo are the same file
Structure	app.py (page + handlers), components.py (reusable builders), theme.py (CSS), plotting.py (figures), services.py (logic), state.py (per-page state)	Handlers never compute; they call services and refresh
Run call:

ui.run(title=APP_TITLE, favicon=..., reload=False, show=True, host="127.0.0.1", port=port, reconnect_timeout=...)
2. Colour tokens (CSS variables on :root)
Token	Hex	Use
--clarus-purple	#70388D	Primary buttons, active toggle, accents in plots
--clarus-dark-purple	#3B1E4D	Plot titles, deep accents
--clarus-lavender	#EFE6F7	Secondary buttons, badges, active tab background
--clarus-light-lavender	#F8F5FB	Main content background, plot area background
--clarus-accent	#C9A3E6	Active sidebar item border, icons on dark surfaces
--clarus-text	#24142F	Body text
--clarus-muted	#6B5B73	Labels, secondary text
--clarus-card	#FFFFFF	Card surface
--clarus-border	#E7DDF0	Card and input borders, plot gridlines
--clarus-success	#1F8A5B	"Active" pill, pass states
--clarus-warning	#B7791F	Running badge text (on #fff7e6)
--clarus-error	#B42318	Stop button, error states
Dark shell colours (not tokens): page body #130d1c; page gradient radial-gradient(circle at top right, #2b183f 0, #171020 34%, #120d1a 100%); sidebar gradient linear-gradient(180deg, #1a1025 0%, #28183b 100%); log box #1a1025 with text #f7ecff.

Design rule: dark purple chrome (sidebar, page edges, log) frames a light lavender workspace with white cards. Purple is the only saturated colour; status colours appear only in small pills and buttons.

3. Page layout
+----------------------+--------------------------------------------------+
| SIDEBAR (260px)      | MAIN AREA (light lavender, padding 22/26px)      |
|  logo + brand title  |  TOP HEADER card: title, "File: name", status     |
|  brand subtitle      |    badge, action buttons (primary/secondary)      |
|  workflow steps 1-5  |  status counters row (pill badges)                |
|  upload box (dashed) |  loaded-items strip (white card, rows)            |
|  secondary button    |  DASHBOARD GRID: graph card (1fr) | metric panel  |
|  loaded-items list   |    (320px, 2-column metric cards)                 |
|                      |  TAB CARD: 6 tabs, one panel each                 |
+----------------------+--------------------------------------------------+
Shell: div.app-shell with display:grid; grid-template-columns: 260px minmax(0,1fr); min-height:100vh.
Sidebar: ui.column.sidebar, padding 24px 18px, gap 18px, right border 1px rgba(231,221,240,.16), shadow 8px 0 28px rgba(0,0,0,.24).
Main: ui.column.main-area, background light lavender.
Top header: white 88 % with backdrop-filter: blur(12px), radius 18px, min-height 72px, shadow 0 18px 44px rgba(59,30,77,.08). Left: page title (1.3rem, weight 800) + "File:" line. Right: status badge then buttons, wrapping.
Dashboard grid: grid-template-columns: minmax(0,1fr) 320px; gap 18px; align-items:start.
Tab card: .card with padding 16px, margin-top 18px, overflow:hidden; ui.tabs().classes("styled-tabs") + ui.tab_panels(...).props("animated").
4. Component vocabulary
Component	Builder / class	Key CSS
Card	.card	white, border 1px --clarus-border, radius 20px, shadow 0 18px 46px rgba(59,30,77,.10)
Metric card	build_metric_card(labels, key, title) -> .metric-card	gradient white to #fbf7ff, radius 18px, padding 12px; label 0.7rem uppercase muted weight 700; value 1.08rem weight 800
Status badge / counter	build_status_counter(label) -> .status-badge	pill (radius 999px), lavender bg, purple text, weight 700, 0.82rem; .running variant amber
Primary button	.primary-button	purple bg, white text, radius 12px, weight 700, shadow 0 10px 24px rgba(112,56,141,.24)
Secondary button	.secondary-button	lavender bg, purple text, radius 12px, weight 700
Stop button	.stop-button	#B42318 bg, white, weight 900, min-width 94px; disabled #D5A29D at 62 %
Workflow step	render_workflow(container, state_fn) -> .workflow-item	full-width row, radius 14px, numbered circle 26px, step name weight 800, status text 0.76rem; .active adds purple 54 % bg and 4px accent left border
Upload box	build_upload_card(...) -> .upload-box	1.5px dashed accent border, radius 16px, white title text on the dark sidebar; ui.upload(auto_upload=True, multiple=True).props("accept=.xlsx")
Loaded-items list	render_workbook_list(...) -> .workbook-row	radius 12px rows with icon, name (0.82rem, weight 800, ellipsis), meta (0.72rem), "Active" green pill or "Open" pill button; .workbook-strip variant restyles it for the light main area
Segmented toggle	ui.toggle({...}).classes("graph-toggle")	lavender pill container, each option a pill; active option purple bg white text
Tabs	.styled-tabs .q-tab	radius 12px, muted weight 700; active gets lavender bg + purple text
Data table	build_data_table(refs, key) -> .data-scroll > .data-table	horizontal scroll wrapper, table min-width 720px
Log box	.log-box	dark, pre-wrap, monospace 0.86rem, radius 14px, 180 to 360px tall, scrolls
Two-column form	.field-grid	grid-template-columns: repeat(2, minmax(0,1fr)); gap 12px
Dialog	ui.dialog() + ui.card().classes("card").style("width:min(760px,92vw); padding:22px; gap:16px;")	footer row justify-end with Close (secondary) and action (primary)
Spacing scale in use: 2, 6, 8, 10, 12, 14, 16, 18, 22, 24 px. Radii: 999px pills, 20px cards, 18px header/metric, 14px workflow/log, 12px buttons/rows.

5. Plot theme (Plotly)
{
  "title": {"x": 0.02, "font": {"size": 18, "color": "#3B1E4D"}},
  "paper_bgcolor": "rgba(255,255,255,0)",
  "plot_bgcolor": "#F8F5FB",
  "font": {"color": "#24142F", "family": "Inter, Segoe UI, sans-serif"},
  "margin": {"l": 56, "r": 24, "t": 56, "b": 48},
  "hovermode": "x unified",
  "legend": {"orientation": "h", "y": 1.02, "x": 0.02},
  "xaxis": {"gridcolor": "#E7DDF0", "zerolinecolor": "#E7DDF0"},
  "yaxis": {"gridcolor": "#E7DDF0", "zerolinecolor": "#E7DDF0"},
}
config = {"displayModeBar": True, "displaylogo": False, "responsive": True,
          "modeBarButtonsToRemove": ["lasso2d", "select2d"]}
Series colours: purple #70388D for the primary trace and fit, accent #C9A3E6 for highlights, dark purple for annotations. An empty placeholder figure is shown before data loads (.empty-graph, min-height 380px). Live plots are capped at 2,000 points per trace.

6. Interaction patterns
Workflow rail: fixed ordered steps (Upload, Verify, Analyze, Calibrate, Export). A workflow_state(step) function returns "pending", "ready", "active" or "complete"; the rail re-renders after every action.
Single status source: one badge in the header shows the state text; set_running(True, "message") switches it to the amber .running variant and disables action buttons; finally: set_running(False) restores them.
Action gating: update_action_states() enables or disables each header button from state (file loaded, results present, run in progress).
Feedback: ui.notify(..., type="positive|warning|negative", multi_line=True) for short messages; a dialog with an issues table (severity, file, sheet, message, suggestion) for validation problems; an append-only log box for the full record.
Multiple documents: up to 5 loaded items in a list with one Active; switching is blocked while a run is in progress.
Downloads: results are written to a temp path, served with ui.download(path, filename=...), and cleaned by a one-shot ui.timer.
Long work: await run.io_bound(fn, ...) keeps the UI responsive; every handler is async and wrapped in try/except with a friendly-error dialog.
Per-page state: a state object is created inside the @ui.page("/") function so each browser tab is independent; temp files are cleaned on disconnect.
7. Responsive rules
max-width: 1120px: shell becomes one column, sidebar hidden, a .mobile-workflow dark card appears at the top of the main area with the workflow steps in a 5-column grid, the upload box and the loaded-items list; dashboard grid becomes one column.
max-width: 780px: main padding 14px, header stretches, metric panel one column.
8. Minimal skeleton for a new app
from nicegui import ui
from web_app import theme, components   # copy theme.py and components.py

APP_TITLE = "New Clarus Tool"

@ui.page("/")
def index() -> None:
    ui.add_css(theme.css())
    ui.query("body").style("background:#130d1c;")
    with ui.element("div").classes("app-shell"):
        with ui.column().classes("sidebar"):
            with ui.row().classes("items-center").style("gap:12px;"):
                ui.image("/reference/clarus_labs.ico").classes("brand-logo")
                with ui.column().style("gap:2px;"):
                    ui.label("Clarus").classes("brand-title")
                    ui.label(APP_TITLE).classes("brand-subtitle")
            workflow = ui.column().classes("w-full workflow-list")
            components.render_workflow(workflow, lambda step: "pending")
        with ui.column().classes("main-area"):
            with ui.row().classes("top-header w-full items-center justify-between"):
                ui.label(APP_TITLE).classes("page-title")
                with ui.row().classes("items-center").style("gap:10px;"):
                    ui.label("Idle").classes("status-badge")
                    ui.button("Run").classes("primary-button")
                    ui.button("Export").classes("secondary-button")
            with ui.element("div").classes("dashboard-grid"):
                with ui.column().classes("card graph-card"):
                    ui.plotly({"data": [], "layout": {}}).classes("w-full empty-graph")
                with ui.column().classes("results-panel"):
                    labels = {}
                    components.build_metric_card(labels, "a", "Metric A")
                    components.build_metric_card(labels, "b", "Metric B")
            with ui.column().classes("card tab-card w-full"):
                with ui.tabs().classes("styled-tabs") as tabs:
                    t1 = ui.tab("Inputs"); t2 = ui.tab("Log")
                with ui.tab_panels(tabs, value=t1).classes("w-full").props("animated"):
                    with ui.tab_panel(t1): ui.label("form here")
                    with ui.tab_panel(t2): ui.label("").classes("log-box w-full")

ui.run(title=APP_TITLE, reload=False, host="127.0.0.1", port=8080)
Files to copy verbatim from the reference app: web_app/theme.py, web_app/components.py, web_app/reference/clarus_labs.ico, and the _base_layout/_config helpers from web_app/plotting.py. Rename the workflow steps and metric cards; keep the tokens, radii and shadows unchanged so the two apps read as one family.

