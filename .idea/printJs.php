<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualizar Mapa</title>
   <link rel="stylesheet" href="css/leaflet.css"/>
    <link rel="stylesheet" href="css/Leaflet.GraphicScale.min.css"/>
    
<link rel="stylesheet" href="css/L.AutoGraticule.css"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" integrity="sha384-xOolHFLEh07PJGoPkLv1IbcEPTNtaed2xpHsD9ESMhqIYd0nLMwNLD69Npy4HI+N" crossorigin="anonymous"/>   
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Georgia', serif;
            background-color: #f5f5f5;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        /* Garante que o mapa principal se adapte */
        html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }

        /* Header com título 
        dinâmico */
        .map-header {
         
            color: black;
            padding: 15px 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            position: relative;
        }

        .map-header h1 {
            font-family: 'Georgia', serif;
            font-size: 24px;
            font-weight: 600;
            margin: 0;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        #mapContainer {
            flex: 1;
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 400px;
            z-index: 1;
            display: none !important;
            
        }

        #mapContainer::before {
                 content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 999;
                    pointer-events: none;
                    box-sizing: border-box;
                    border: 50px solid transparent;
                    border-image: url('css/images/borda.png') 50 stretch;
            }

       /* Footer */
.preview-footer {

    color: black;
    padding: 12px 20px;
    text-align: left; /* Alinha todo o conteúdo à esquerda */
    font-size: 12px;
    line-height: 1.4;
 
    z-index: 1000;
    position: relative;
    display: flex;
    justify-content: space-between; /* Texto à esquerda, logo à direita */
    align-items: center;
}


.preview-footer .footer-logo {
    flex-shrink: 0;

}

.preview-footer .footer-logo img {
    height: 80px; /* Tamanho pequeno para o logo */
    width: auto;
    right: 0;    
}

.preview-footer p {
    margin: 2px 0;
    font-size: 8px;
    text-align: justify;
}

.preview-footer .copyright {
    font-weight: 600;
    color: black;
}
.preview-footer.institution {
    font-style: italic;
    color: black;
}

        /* Botão para abrir modal */
        .open-export-btn {
            display: none !important;
            position: fixed;
            top: 90px;
            left: 20px;
            z-index: 1000;
            padding: 12px 24px;
            background: orange;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
            transition: all 0.3s;
            font-family: 'Georgia', serif;
        }

        .open-export-btn:hover {
            background: green;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        }

        /* Modal de Exportação */
    .export-modal {
    position: static !important; /* Não é mais fixo */
    background-color: transparent !important; /* Remove o fundo escuro */
    width: 100% !important;
    height: 100% !important;
    overflow-y: visible !important; 
    z-index: 1;
    display: flex !important; /* Adiciona flex para ocupar o espaço do body */
    flex: 1; 
}


    .export-modal {
            display: flex;
            position: static;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            overflow-y: auto;
        }

        .export-modal-content {
           margin: 0 !important; /* Remove a margem de centralização */
    width: 100% !important;
    max-width: none !important; /* Ocupa toda a largura */
    height: 100%; /* Ocupa toda a altura disponível */
    border-radius: 0 !important; /* Remove o border-radius */
    box-shadow: none !important; /* Remove a sombra */
    display: flex; /* Adiciona flex para controlar o layout interno */
    flex-direction: column;
    box-sizing: border-box;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e0e0e0;
        }

        .modal-header h2 {
            margin: 0;
            font-family: 'Georgia', serif;
            color: #2c3e50;
        }


        .close-modal {
            font-size: 32px;
            font-weight: bold;
            color: #999;
            cursor: pointer;
            transition: color 0.3s;
        }

        .close-modal:hover {
            color: #e74c3c;
        }

        .modal-body {
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 30px;
            margin-bottom: 25px;
            max-height: 70vh;
        }

        /* Painel de Controles */
        .controls-panel {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            height: fit-content;
            overflow-y: auto;
            max-height: 70vh;
        }

        .control-group {
            margin-bottom: 20px;
        }

        .control-group h3 {
            font-family: 'Georgia', serif;
            font-size: 14px;
            margin-bottom: 10px;
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
        }

        .control-option {
            margin-bottom: 10px;
        }

        .control-option label {
            display: flex;
            align-items: center;
            cursor: pointer;
            font-size: 13px;
            color: #555;
            transition: color 0.2s;
        }

        .control-option label:hover {
            color: #3498db;
        }

        .control-option input[type="radio"],
        .control-option input[type="checkbox"] {
            margin-right: 8px;
            cursor: pointer;
        }

        .control-option input[type="number"],
        .control-option select {
            width: 100%;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 5px;
        }
        
        .control-option input[type="range"] {
            width: 100%;
            margin-top: 5px;
            cursor: pointer;
        }
        
        .control-option input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #3498db;
            cursor: pointer;
        }
        
        .control-option input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #3498db;
            cursor: pointer;
            border: none;
        }

        .format-options {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            margin-top: 10px;
        }
        
        @media (max-width: 1200px) {
            .format-options {
                grid-template-columns: 1fr 1fr;
            }
        }

        .format-option {
            display: flex;
            flex-direction: column;
        }

        .format-option label {
            font-size: 11px;
            color: #666;
            margin-bottom: 4px;
        }

        /* Área de Preview */
        .preview-area {
            background: #fff;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            overflow: auto;
            max-height: 70vh;
            width: 100%;
            box-sizing: border-box;
        }

        .preview-container {
            width: 100%;
            max-width: 100%;
            background: white;
            position: relative;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }

        /* Título e Footer no Preview */
        .preview-title {
            
            color: black;
            padding: 15px;
            text-align: center;
            font-family: 'Georgia', serif;
            font-size: 20px;
            font-weight: 600;
            
        }

        .preview-footer {
            
            color: black;
            padding: 10px 15px;
            text-align: center;
            font-family: 'Georgia', serif;
            font-size: 11px;
            line-height: 1.4;
            
        }

        .preview-footer p {
            margin: 2px 0;
        }

        .preview-footer .copyright {
            color: #3498db;
            font-weight: 600;
        }

        /* Layouts */
        .layout-inside {
            position: relative;
            display: flex;
            gap: 10px;
        }


        .layout-inside .map-preview {
            width: 100%;
            height: 500px;
            min-height: 400px;
            position: relative;
        }

        .layout-inside .legend-preview {
            position: absolute;
            top: auto;
            bottom: 19%;
            right: 15px;
            width: auto;
            min-width: 200px;
            max-width: 400px;
            min-height: 100px;
            max-height: 60%;
            overflow-y: auto;
            background: white;
            z-index: 1000;
            border: 3px solid orange;
            cursor: move;
            user-select: none;
        }

        /* Legenda abaixo não é arrastável */
        .layout-bottom .legend-preview {
            cursor: default;
            user-select: auto;
        }

        .layout-bottom .legend-preview .legend-resize-handle {
            display: none !important;
        }
        
        /* Legenda à direita pode ser redimensionada pela borda esquerda */
        .layout-right .legend-preview {
            cursor: default;
            user-select: auto;
            position: relative;
        }
        
        /* Handle de resize na borda esquerda da legenda quando está à direita */
        .layout-right .legend-preview .legend-resize-handle-left {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 8px;
            cursor: ew-resize;
            z-index: 1002;
            background: transparent;
            transition: background 0.2s;
        }
        
        .layout-right .legend-preview .legend-resize-handle-left:hover {
            background: rgba(255, 107, 0, 0.3);
        }
        
        .layout-right .legend-preview.resizing .legend-resize-handle-left {
            background: rgba(255, 107, 0, 0.5);
        }
        
        /* Remove o handle padrão (canto inferior direito) quando está à direita */
        .layout-right .legend-preview .legend-resize-handle {
            display: none !important;
        }

        /* Estilos para legenda arrastável e redimensionável */
        .legend-preview.draggable {
            cursor: move;
        }

        .legend-preview .legend-resize-handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            background: white;
            cursor: nwse-resize;
            z-index: 1001;
            border-top: 2px solid white;
            border-left: 2px solid white;
            border-radius: 0 0 4px 0;
            display: none;
        }

        /* Mostra handle apenas quando legenda está dentro do mapa */
        .layout-inside .legend-preview .legend-resize-handle,
        .layout-with-location.layout-inside .legend-preview .legend-resize-handle {
            display: block;
        }
        
        /* Mostra handle na borda esquerda quando legenda está à direita */
        .layout-right .legend-preview .legend-resize-handle-left,
        .layout-with-location.layout-right .legend-preview .legend-resize-handle-left {
            display: block;
        }

        .legend-preview .legend-resize-handle:hover {
            background: #ff6b00;
        }

        .legend-preview .legend-resize-handle::after {
            content: '';
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 0 0 8px 8px;
            border-color: transparent transparent white transparent;
        }

        .legend-preview.resizing {
            user-select: none;
        }

        .legend-preview.dragging {
            opacity: 0.8;
        }

        .layout-right {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
        }

        .layout-right .map-preview {
            width: 100%;
            height: 500px;
            min-height: 400px;
        }

        .layout-bottom {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .layout-bottom .map-preview {
            width: 100%;
            height: 500px;
            min-height: 400px;
        }

        .map-preview {
            background: #e8f4f8;
            border: 3px solid orange;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 100%;
            min-height: 400px;
        }

        .legend-preview {
            background: white;
            border: 3px solid orange;
            border-radius: 4px;
            padding: 12px;
            overflow-y: auto;
        }

        .legend-preview h4 {
            font-family: 'Georgia', serif;
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #2c3e50;
            border-bottom: 2px solid orange;
            padding-bottom: 6px;
        }

        .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding: 4px 8px;
    transition: background-color 0.2s;
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
    width: 100%;
    min-height: 24px;
    box-sizing: border-box;
}

        .legend-item:last-child {
           
        }

        .legend-item:hover {
            background-color: #fff8e1;
        }


        .legend-symbol img {
            max-width: 22px;
            max-height: 22px;
        }

        .legend-label {
    font-family: 'system-ui', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    color: #333;
    word-wrap: break-word;
    flex: 1;
    line-height: 1.3;
    padding-top: 1px;
    font-variant-numeric: tabular-nums;
}
        /* Colunas */
        .legend-columns-1 {
            column-count: 1;
        }

        .legend-columns-2 {
            column-count: 2;
            column-gap: 12px;
        }

        .legend-columns-3 {
            column-count: 3;
            column-gap: 12px;
        }

        .legend-columns-4 {
            column-count: 4;
            column-gap: 12px;
        }

        .legend-columns-5 {
            column-count: 5;
            column-gap: 12px;
        }

        .legend-columns-6 {
            column-count: 6;
            column-gap: 12px;
        }

        /* Tamanhos de fonte - 8 a 18 */
        .font-size-8 .legend-label { font-size: 8px; }
        .font-size-8 .legend-symbol { min-width: 16px; }
        .font-size-8 .legend-preview h4 { font-size: 10px; }

        .font-size-10 .legend-label { font-size: 10px; }
        .font-size-10 .legend-symbol { min-width: 18px; }
        .font-size-10 .legend-preview h4 { font-size: 12px; }

        .font-size-12 .legend-label { font-size: 12px; }
        .font-size-12 .legend-symbol { min-width: 22px; }
        .font-size-12 .legend-preview h4 { font-size: 14px; }

        .font-size-14 .legend-label { font-size: 14px; }
        .font-size-14 .legend-symbol { min-width: 24px; }
        .font-size-14 .legend-preview h4 { font-size: 16px; }

        .font-size-16 .legend-label { font-size: 16px; }
        .font-size-16 .legend-symbol { min-width: 26px; }
        .font-size-16 .legend-preview h4 { font-size: 18px; }

        .font-size-18 .legend-label { font-size: 18px; }
        .font-size-18 .legend-symbol { min-width: 28px; }
        .font-size-18 .legend-preview h4 { font-size: 20px; }

        /* Ajustes para ícones em diferentes tamanhos */
        .font-size-8 .legend-symbol img,
        .font-size-8 .legend-symbol div {
            transform: scale(0.6);
        }

        .font-size-10 .legend-symbol img,
        .font-size-10 .legend-symbol div {
            transform: scale(0.75);
        }

        .font-size-12 .legend-symbol img,
        .font-size-12 .legend-symbol div {
            transform: scale(0.9);
        }

        .font-size-14 .legend-symbol img,
        .font-size-14 .legend-symbol div {
            transform: scale(1);
        }

        .font-size-16 .legend-symbol img,
        .font-size-16 .legend-symbol div {
            transform: scale(1.1);
        }

        .font-size-18 .legend-symbol img,
        .font-size-18 .legend-symbol div {
            transform: scale(1.25);
        }

        /* Compactação da legenda conforme tamanho de fonte */
        /* Nota: max-width removido para layout-right (largura controlada pelo grid) */
        .legend-preview.font-size-8 { padding: 4px 6px; }
        .legend-preview.font-size-10 { padding: 6px 8px; }
        .legend-preview.font-size-12 { padding: 8px 10px; }
        .legend-preview.font-size-14 { padding: 10px 12px; }
        .legend-preview.font-size-16 { padding: 12px 14px; }
        .legend-preview.font-size-18 { padding: 14px 16px; }
        
        /* Espaçamento muito compacto - reduz padding */
        .legend-spacing-very-compact.legend-preview.font-size-8 { padding: 1px 3px; }
        .legend-spacing-very-compact.legend-preview.font-size-10 { padding: 2px 4px; }
        .legend-spacing-very-compact.legend-preview.font-size-12 { padding: 3px 5px; }
        .legend-spacing-very-compact.legend-preview.font-size-14 { padding: 4px 6px; }
        .legend-spacing-very-compact.legend-preview.font-size-16 { padding: 5px 7px; }
        .legend-spacing-very-compact.legend-preview.font-size-18 { padding: 6px 8px; }
        
        /* Espaçamento compacto - reduz padding */
        .legend-spacing-compact.legend-preview.font-size-8 { padding: 2px 4px; }
        .legend-spacing-compact.legend-preview.font-size-10 { padding: 4px 6px; }
        .legend-spacing-compact.legend-preview.font-size-12 { padding: 6px 8px; }
        .legend-spacing-compact.legend-preview.font-size-14 { padding: 8px 10px; }
        .legend-spacing-compact.legend-preview.font-size-16 { padding: 10px 12px; }
        .legend-spacing-compact.legend-preview.font-size-18 { padding: 12px 14px; }
        
        /* Espaçamento amplo - aumenta padding */
        .legend-spacing-loose.legend-preview.font-size-8 { padding: 6px 10px; }
        .legend-spacing-loose.legend-preview.font-size-10 { padding: 8px 12px; }
        .legend-spacing-loose.legend-preview.font-size-12 { padding: 10px 14px; }
        .legend-spacing-loose.legend-preview.font-size-14 { padding: 12px 16px; }
        .legend-spacing-loose.legend-preview.font-size-16 { padding: 14px 18px; }
        .legend-spacing-loose.legend-preview.font-size-18 { padding: 16px 20px; }
        
        /* Espaçamento muito amplo - aumenta padding ainda mais */
        .legend-spacing-very-loose.legend-preview.font-size-8 { padding: 8px 12px; }
        .legend-spacing-very-loose.legend-preview.font-size-10 { padding: 10px 14px; }
        .legend-spacing-very-loose.legend-preview.font-size-12 { padding: 12px 16px; }
        .legend-spacing-very-loose.legend-preview.font-size-14 { padding: 14px 18px; }
        .legend-spacing-very-loose.legend-preview.font-size-16 { padding: 16px 20px; }
        .legend-spacing-very-loose.legend-preview.font-size-18 { padding: 18px 22px; }

        /* Espaçamento base por tamanho de fonte (quanto menor a fonte, menor o espaçamento) */
        .font-size-8 #legendItems .legend-item { margin-bottom: 2px; padding: 1px 1px; }
        .font-size-10 #legendItems .legend-item { margin-bottom: 3px; padding: 2px 2px; }
        .font-size-12 #legendItems .legend-item { margin-bottom: 4px; padding: 3px 3px; }
        .font-size-14 #legendItems .legend-item { margin-bottom: 5px; padding: 4px 4px; }
        .font-size-16 #legendItems .legend-item { margin-bottom: 6px; padding: 5px 5px; }
        .font-size-18 #legendItems .legend-item { margin-bottom: 7px; padding: 6px 6px; }
        
        /* Espaçamento muito compacto (reduz ao máximo) */
        .legend-spacing-very-compact.font-size-8 #legendItems .legend-item { margin-bottom: 0px; padding: 0px 0px; }
        .legend-spacing-very-compact.font-size-10 #legendItems .legend-item { margin-bottom: 1px; padding: 0px 0px; }
        .legend-spacing-very-compact.font-size-12 #legendItems .legend-item { margin-bottom: 1px; padding: 1px 1px; }
        .legend-spacing-very-compact.font-size-14 #legendItems .legend-item { margin-bottom: 2px; padding: 1px 1px; }
        .legend-spacing-very-compact.font-size-16 #legendItems .legend-item { margin-bottom: 3px; padding: 2px 2px; }
        .legend-spacing-very-compact.font-size-18 #legendItems .legend-item { margin-bottom: 4px; padding: 3px 3px; }
        
        /* Espaçamento compacto (reduz ainda mais) */
        .legend-spacing-compact.font-size-8 #legendItems .legend-item { margin-bottom: 1px; padding: 0px 0px; }
        .legend-spacing-compact.font-size-10 #legendItems .legend-item { margin-bottom: 2px; padding: 1px 1px; }
        .legend-spacing-compact.font-size-12 #legendItems .legend-item { margin-bottom: 3px; padding: 2px 2px; }
        .legend-spacing-compact.font-size-14 #legendItems .legend-item { margin-bottom: 4px; padding: 3px 3px; }
        .legend-spacing-compact.font-size-16 #legendItems .legend-item { margin-bottom: 5px; padding: 4px 4px; }
        .legend-spacing-compact.font-size-18 #legendItems .legend-item { margin-bottom: 6px; padding: 5px 5px; }
        
        /* Espaçamento amplo (aumenta) */
        .legend-spacing-loose.font-size-8 #legendItems .legend-item { margin-bottom: 4px; padding: 3px 3px; }
        .legend-spacing-loose.font-size-10 #legendItems .legend-item { margin-bottom: 5px; padding: 4px 4px; }
        .legend-spacing-loose.font-size-12 #legendItems .legend-item { margin-bottom: 7px; padding: 5px 5px; }
        .legend-spacing-loose.font-size-14 #legendItems .legend-item { margin-bottom: 8px; padding: 6px 6px; }
        .legend-spacing-loose.font-size-16 #legendItems .legend-item { margin-bottom: 9px; padding: 7px 7px; }
        .legend-spacing-loose.font-size-18 #legendItems .legend-item { margin-bottom: 10px; padding: 8px 8px; }
        
        /* Espaçamento muito amplo (aumenta ao máximo) */
        .legend-spacing-very-loose.font-size-8 #legendItems .legend-item { margin-bottom: 6px; padding: 5px 5px; }
        .legend-spacing-very-loose.font-size-10 #legendItems .legend-item { margin-bottom: 7px; padding: 6px 6px; }
        .legend-spacing-very-loose.font-size-12 #legendItems .legend-item { margin-bottom: 9px; padding: 7px 7px; }
        .legend-spacing-very-loose.font-size-14 #legendItems .legend-item { margin-bottom: 10px; padding: 8px 8px; }
        .legend-spacing-very-loose.font-size-16 #legendItems .legend-item { margin-bottom: 11px; padding: 9px 9px; }
        .legend-spacing-very-loose.font-size-18 #legendItems .legend-item { margin-bottom: 12px; padding: 10px 10px; }

        /* Gap entre colunas - ajustado por tamanho de fonte */
        .font-size-8 .legend-columns-2,
        .font-size-8 .legend-columns-3,
        .font-size-8 .legend-columns-4,
        .font-size-8 .legend-columns-5,
        .font-size-8 .legend-columns-6 { column-gap: 6px; }

        .font-size-10 .legend-columns-2,
        .font-size-10 .legend-columns-3,
        .font-size-10 .legend-columns-4,
        .font-size-10 .legend-columns-5,
        .font-size-10 .legend-columns-6 { column-gap: 8px; }
        
        .font-size-12 .legend-columns-2,
        .font-size-12 .legend-columns-3,
        .font-size-12 .legend-columns-4,
        .font-size-12 .legend-columns-5,
        .font-size-12 .legend-columns-6 { column-gap: 10px; }
        
        .font-size-14 .legend-columns-2,
        .font-size-14 .legend-columns-3,
        .font-size-14 .legend-columns-4,
        .font-size-14 .legend-columns-5,
        .font-size-14 .legend-columns-6 { column-gap: 12px; }
        
        .font-size-16 .legend-columns-2,
        .font-size-16 .legend-columns-3,
        .font-size-16 .legend-columns-4,
        .font-size-16 .legend-columns-5,
        .font-size-16 .legend-columns-6 { column-gap: 14px; }
        
        .font-size-18 .legend-columns-2,
        .font-size-18 .legend-columns-3,
        .font-size-18 .legend-columns-4,
        .font-size-18 .legend-columns-5,
        .font-size-18 .legend-columns-6 { column-gap: 16px; }
        
        /* Espaçamento compacto - reduz gap entre colunas */
        .legend-spacing-compact.font-size-8 .legend-columns-2,
        .legend-spacing-compact.font-size-8 .legend-columns-3,
        .legend-spacing-compact.font-size-8 .legend-columns-4,
        .legend-spacing-compact.font-size-8 .legend-columns-5,
        .legend-spacing-compact.font-size-8 .legend-columns-6 { column-gap: 4px; }
        
        .legend-spacing-compact.font-size-10 .legend-columns-2,
        .legend-spacing-compact.font-size-10 .legend-columns-3,
        .legend-spacing-compact.font-size-10 .legend-columns-4,
        .legend-spacing-compact.font-size-10 .legend-columns-5,
        .legend-spacing-compact.font-size-10 .legend-columns-6 { column-gap: 6px; }
        
        .legend-spacing-compact.font-size-12 .legend-columns-2,
        .legend-spacing-compact.font-size-12 .legend-columns-3,
        .legend-spacing-compact.font-size-12 .legend-columns-4,
        .legend-spacing-compact.font-size-12 .legend-columns-5,
        .legend-spacing-compact.font-size-12 .legend-columns-6 { column-gap: 8px; }
        
        .legend-spacing-compact.font-size-14 .legend-columns-2,
        .legend-spacing-compact.font-size-14 .legend-columns-3,
        .legend-spacing-compact.font-size-14 .legend-columns-4,
        .legend-spacing-compact.font-size-14 .legend-columns-5,
        .legend-spacing-compact.font-size-14 .legend-columns-6 { column-gap: 10px; }
        
        .legend-spacing-compact.font-size-16 .legend-columns-2,
        .legend-spacing-compact.font-size-16 .legend-columns-3,
        .legend-spacing-compact.font-size-16 .legend-columns-4,
        .legend-spacing-compact.font-size-16 .legend-columns-5,
        .legend-spacing-compact.font-size-16 .legend-columns-6 { column-gap: 12px; }
        
        .legend-spacing-compact.font-size-18 .legend-columns-2,
        .legend-spacing-compact.font-size-18 .legend-columns-3,
        .legend-spacing-compact.font-size-18 .legend-columns-4,
        .legend-spacing-compact.font-size-18 .legend-columns-5,
        .legend-spacing-compact.font-size-18 .legend-columns-6 { column-gap: 14px; }
        
        /* Espaçamento amplo - aumenta gap entre colunas */
        .legend-spacing-loose.font-size-8 .legend-columns-2,
        .legend-spacing-loose.font-size-8 .legend-columns-3,
        .legend-spacing-loose.font-size-8 .legend-columns-4,
        .legend-spacing-loose.font-size-8 .legend-columns-5,
        .legend-spacing-loose.font-size-8 .legend-columns-6 { column-gap: 10px; }
        
        .legend-spacing-loose.font-size-10 .legend-columns-2,
        .legend-spacing-loose.font-size-10 .legend-columns-3,
        .legend-spacing-loose.font-size-10 .legend-columns-4,
        .legend-spacing-loose.font-size-10 .legend-columns-5,
        .legend-spacing-loose.font-size-10 .legend-columns-6 { column-gap: 12px; }
        
        .legend-spacing-loose.font-size-12 .legend-columns-2,
        .legend-spacing-loose.font-size-12 .legend-columns-3,
        .legend-spacing-loose.font-size-12 .legend-columns-4,
        .legend-spacing-loose.font-size-12 .legend-columns-5,
        .legend-spacing-loose.font-size-12 .legend-columns-6 { column-gap: 14px; }
        
        .legend-spacing-loose.font-size-14 .legend-columns-2,
        .legend-spacing-loose.font-size-14 .legend-columns-3,
        .legend-spacing-loose.font-size-14 .legend-columns-4,
        .legend-spacing-loose.font-size-14 .legend-columns-5,
        .legend-spacing-loose.font-size-14 .legend-columns-6 { column-gap: 16px; }
        
        .legend-spacing-loose.font-size-16 .legend-columns-2,
        .legend-spacing-loose.font-size-16 .legend-columns-3,
        .legend-spacing-loose.font-size-16 .legend-columns-4,
        .legend-spacing-loose.font-size-16 .legend-columns-5,
        .legend-spacing-loose.font-size-16 .legend-columns-6 { column-gap: 18px; }
        
        .legend-spacing-loose.font-size-18 .legend-columns-2,
        .legend-spacing-loose.font-size-18 .legend-columns-3,
        .legend-spacing-loose.font-size-18 .legend-columns-4,
        .legend-spacing-loose.font-size-18 .legend-columns-5,
        .legend-spacing-loose.font-size-18 .legend-columns-6 { column-gap: 20px; }
        
        /* Espaçamento muito compacto - reduz gap entre colunas ao mínimo */
        .legend-spacing-very-compact.font-size-8 .legend-columns-2,
        .legend-spacing-very-compact.font-size-8 .legend-columns-3,
        .legend-spacing-very-compact.font-size-8 .legend-columns-4,
        .legend-spacing-very-compact.font-size-8 .legend-columns-5,
        .legend-spacing-very-compact.font-size-8 .legend-columns-6 { column-gap: 3px; }
        
        .legend-spacing-very-compact.font-size-10 .legend-columns-2,
        .legend-spacing-very-compact.font-size-10 .legend-columns-3,
        .legend-spacing-very-compact.font-size-10 .legend-columns-4,
        .legend-spacing-very-compact.font-size-10 .legend-columns-5,
        .legend-spacing-very-compact.font-size-10 .legend-columns-6 { column-gap: 4px; }
        
        .legend-spacing-very-compact.font-size-12 .legend-columns-2,
        .legend-spacing-very-compact.font-size-12 .legend-columns-3,
        .legend-spacing-very-compact.font-size-12 .legend-columns-4,
        .legend-spacing-very-compact.font-size-12 .legend-columns-5,
        .legend-spacing-very-compact.font-size-12 .legend-columns-6 { column-gap: 6px; }
        
        .legend-spacing-very-compact.font-size-14 .legend-columns-2,
        .legend-spacing-very-compact.font-size-14 .legend-columns-3,
        .legend-spacing-very-compact.font-size-14 .legend-columns-4,
        .legend-spacing-very-compact.font-size-14 .legend-columns-5,
        .legend-spacing-very-compact.font-size-14 .legend-columns-6 { column-gap: 8px; }
        
        .legend-spacing-very-compact.font-size-16 .legend-columns-2,
        .legend-spacing-very-compact.font-size-16 .legend-columns-3,
        .legend-spacing-very-compact.font-size-16 .legend-columns-4,
        .legend-spacing-very-compact.font-size-16 .legend-columns-5,
        .legend-spacing-very-compact.font-size-16 .legend-columns-6 { column-gap: 10px; }
        
        .legend-spacing-very-compact.font-size-18 .legend-columns-2,
        .legend-spacing-very-compact.font-size-18 .legend-columns-3,
        .legend-spacing-very-compact.font-size-18 .legend-columns-4,
        .legend-spacing-very-compact.font-size-18 .legend-columns-5,
        .legend-spacing-very-compact.font-size-18 .legend-columns-6 { column-gap: 12px; }
        
        /* Espaçamento muito amplo - aumenta gap entre colunas ao máximo */
        .legend-spacing-very-loose.font-size-8 .legend-columns-2,
        .legend-spacing-very-loose.font-size-8 .legend-columns-3,
        .legend-spacing-very-loose.font-size-8 .legend-columns-4,
        .legend-spacing-very-loose.font-size-8 .legend-columns-5,
        .legend-spacing-very-loose.font-size-8 .legend-columns-6 { column-gap: 12px; }
        
        .legend-spacing-very-loose.font-size-10 .legend-columns-2,
        .legend-spacing-very-loose.font-size-10 .legend-columns-3,
        .legend-spacing-very-loose.font-size-10 .legend-columns-4,
        .legend-spacing-very-loose.font-size-10 .legend-columns-5,
        .legend-spacing-very-loose.font-size-10 .legend-columns-6 { column-gap: 14px; }
        
        .legend-spacing-very-loose.font-size-12 .legend-columns-2,
        .legend-spacing-very-loose.font-size-12 .legend-columns-3,
        .legend-spacing-very-loose.font-size-12 .legend-columns-4,
        .legend-spacing-very-loose.font-size-12 .legend-columns-5,
        .legend-spacing-very-loose.font-size-12 .legend-columns-6 { column-gap: 16px; }
        
        .legend-spacing-very-loose.font-size-14 .legend-columns-2,
        .legend-spacing-very-loose.font-size-14 .legend-columns-3,
        .legend-spacing-very-loose.font-size-14 .legend-columns-4,
        .legend-spacing-very-loose.font-size-14 .legend-columns-5,
        .legend-spacing-very-loose.font-size-14 .legend-columns-6 { column-gap: 18px; }
        
        .legend-spacing-very-loose.font-size-16 .legend-columns-2,
        .legend-spacing-very-loose.font-size-16 .legend-columns-3,
        .legend-spacing-very-loose.font-size-16 .legend-columns-4,
        .legend-spacing-very-loose.font-size-16 .legend-columns-5,
        .legend-spacing-very-loose.font-size-16 .legend-columns-6 { column-gap: 20px; }
        
        .legend-spacing-very-loose.font-size-18 .legend-columns-2,
        .legend-spacing-very-loose.font-size-18 .legend-columns-3,
        .legend-spacing-very-loose.font-size-18 .legend-columns-4,
        .legend-spacing-very-loose.font-size-18 .legend-columns-5,
        .legend-spacing-very-loose.font-size-18 .legend-columns-6 { column-gap: 22px; }

        /* Botões */
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            padding-top: 15px;
            border-top: 2px solid #e0e0e0;
        }

        .btn {
            padding: 10px 24px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            font-family: 'Georgia', serif;
        }

        .btn-primary {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
        }

        .btn-primary:hover {
            background: linear-gradient(135deg, #2980b9, #21618c);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
        }

        .btn-success {
            background: linear-gradient(135deg, #27ae60, #229954);
            color: white;
        }

        .btn-success:hover {
            background: linear-gradient(135deg, #229954, #1e8449);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
        }

        .btn-secondary {
            background: #95a5a6;
            color: white;
        }

        .btn-secondary:hover {
            background: #7f8c8d;
        }

        /* Loading */
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            border-radius: 8px;
            z-index: 10001;
        }

        .loading.active {
            display: block;
        }

        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .leaflet-container {
            font-family: 'Georgia', serif;
        }

        @media (max-width: 1200px) {
            .modal-body {
                grid-template-columns: 1fr;
            }
        }

       .legend-symbol {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 36px;
    min-width: 36px;
    flex-shrink: 0;
    overflow: visible;
}

        .legend-symbol img {
            width: 20px !important;
            height: 20px !important;
            object-fit: contain;
        }

        .legend-symbol div {
            width: 18px !important;
            height: 18px !important;
        }

        .legend-symbol svg {
            display: block;
            /* Não forçar tamanho aqui — cada SVG declara seu próprio width/height */
        }

        /* Estilo para o norte */
        .leaflet-control .img {
            background: transparent !important;
            border: none !important;
        }

        /* Estilo para a escala gráfica */
        .leaflet-control-graphicScale {
            background: white;
            padding: 5px;
            border-radius: 4px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            z-index: 1001;
        }

        /* Estilo para a grade */
        .leaflet-graticule-line {
            stroke: #ccc;
            stroke-width: 1px;
            stroke-dasharray: 2, 2;
        }

        .leaflet-graticule-label {
            background: rgba(255, 255, 255, 0.8);
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 10px;
            font-family: 'Georgia', serif;
            z-index: 1001;
        }
     
        /* Ajusta o grid do layout à direita para suportar título acima, mapa e legenda lado a lado */
        .layout-right {
            display: grid;
            grid-template-columns: 1fr minmax(260px, 35%);
            grid-template-rows: auto 1fr auto;
            gap: 15px;
            align-items: start;
        }
        
        /* Remove max-width da legenda quando está no layout-right (largura controlada pelo grid) */
        .layout-right .legend-preview {
            max-width: none !important;
            width: 100%;
        }
        
        /* Layout com localização à direita - também precisa ter largura ajustável */
        .layout-with-location.layout-right .legend-preview {
            max-width: none !important;
            width: 100%;
            position: relative;
            bottom: auto;
            right: auto;
        }

        /* Posicionamento explícito para evitar deslocamentos causados pelo título */
        .layout-right .preview-title { grid-column: 1 / -1; grid-row: 1; }
        .layout-right .map-preview { grid-column: 1; grid-row: 2; width: 100%; height: 500px; min-height: 400px; }
        .layout-right .legend-preview { grid-column: 2; grid-row: 2; align-self: start; max-height: 500px; overflow-y: auto; }
        .layout-right .preview-footer { grid-column: 1 / -1; grid-row: 3; }

        /* Responsividade geral */
        @media (max-width: 1400px) {
            .preview-container {
                font-size: 0.95em;
            }
        }

        @media (max-width: 768px) {
            .preview-container {
                font-size: 0.85em;
            }

            .map-preview {
                min-height: 300px !important;
            }

            .location-map {
                height: 130px;
                min-height: 100px;
            }
        }

        /* Melhorias no título da legenda para não estourar largura */
        .legend-preview h4 { white-space: normal; word-break: break-word; overflow-wrap: anywhere; }

        /* Melhorias de distribuição nas colunas */
       .legend-columns-2,
.legend-columns-3,
.legend-columns-4,
.legend-columns-5,
.legend-columns-6 {
    column-fill: balance;
    -moz-column-fill: balance;
    column-gap: 15px;
}
.legend-columns-2 { column-count: 2; }
.legend-columns-3 { column-count: 3; }
.legend-columns-4 { column-count: 4; }
.legend-columns-5 { column-count: 5; }
.legend-columns-6 { column-count: 6; }
        .legend-item { page-break-inside: avoid; -webkit-column-break-inside: avoid; }

.custom-navbar {
                position: fixed;

                top: 10px;

                left: 50%;

                transform: translateX(-50%);

                z-index: 1000;

                width: auto;

                padding: 10px 20px;
            }

            .custom-navbar::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
                pointer-events: none;
                box-sizing: border-box;
                border: 10px solid transparent;
                border-image: url('css/images/borda.png') 30 stretch;
            }

        /* Estilos para mapas de localização */
        .location-maps-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
            max-width: 220px; /* Reduzido de 250px */
            min-width: 180px; /* Reduzido de 200px */
        }

        .location-map {
            width: 100%;
            height: 140px; /* Reduzido de 160px */
            min-height: 100px; /* Reduzido de 120px */
            border: 3px solid orange;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
        }

        .location-map.hidden {
            display: none;
        }

        /* Layout melhorado para mapas de localização */
        .layout-with-location {
            display: grid;
            grid-template-columns: auto 1fr;
            grid-template-rows: auto 1fr auto;
            gap: 15px;
            align-items: start;
        }

        .layout-with-location .preview-title {
            grid-column: 1 / -1;
            grid-row: 1;
        }

        .layout-with-location .location-maps-container {
            grid-column: 1;
            grid-row: 2;
            align-self: start;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .layout-with-location .map-preview {
            grid-column: 2;
            grid-row: 2;
            width: 100%;
            height: 500px;
            min-height: 500px;
            max-height: 500px;
        }

        .layout-with-location .legend-preview {
            grid-column: 2;
            grid-row: 2;
            position: absolute;
            bottom: 19%;
            right: 15px;
            max-width: 300px;
            max-height: 60%;
            overflow-y: auto;
            z-index: 1000;
        }

        .layout-with-location .preview-footer {
            grid-column: 1 / -1;
            grid-row: 3;
        }

        /* Layout com mapas de localização + legenda embaixo */
        .layout-with-location.layout-bottom {
            grid-template-columns: auto 1fr;
            grid-template-rows: auto 1fr auto auto;
        }

        .layout-with-location.layout-bottom .preview-title {
            grid-column: 1 / -1;
            grid-row: 1;
        }

        .layout-with-location.layout-bottom .location-maps-container {
            grid-column: 1;
            grid-row: 2;
            align-self: center;
            max-width: 250px;
            flex-direction: column;
            gap: 10px;
        }

        .layout-with-location.layout-bottom .map-preview {
            grid-column: 2;
            grid-row: 2;
            width: 100%;
            height: 500px;
            min-height: 500px;
            max-height: 500px;
        }

        .layout-with-location.layout-bottom .legend-preview {
            grid-column: 2;
            grid-row: 3;
            position: relative;
            bottom: auto;
            right: auto;
            max-width: 100%;
            max-height: none;
            width: 100%;
            border: 3px solid orange;
        }

        .layout-with-location.layout-bottom .preview-footer {
            grid-column: 1 / -1;
            grid-row: 4;
        }

        /* Layout com mapas de localização + legenda à direita */
        .layout-with-location.layout-right {
            grid-template-columns: 1fr auto;
            grid-template-rows: auto 1fr auto auto; /* título, mapa/legenda, mapas de localização, footer */
        }

        .layout-with-location.layout-right .preview-title {
            grid-column: 1 / -1;
            grid-row: 1;
        }

        .layout-with-location.layout-right .map-preview {
            grid-column: 1;
            grid-row: 2;
            width: 100%;
            height: 500px;
            min-height: 500px;
            max-height: 500px;
        }

        .layout-with-location.layout-right .legend-preview {
            grid-column: 2;
            grid-row: 2;
            position: relative;
            bottom: auto;
            right: auto;
            max-width: none !important;
            max-height: 500px;
            width: 100%;
            align-self: start;
            border: 3px solid orange;
        }

        .layout-with-location.layout-right .location-maps-container {
            grid-column: 1;  /* abaixo do MAPA (coluna do mapa) */
            grid-row: 3;     /* linha logo abaixo do mapa */
            align-self: start;
            display: flex;
            flex-direction: row;
            justify-content: center; /* centraliza mapLoc1 e mapLoc2 */
            align-items: flex-start;
            gap: 10px;
            width: 100%;
            max-width: none; /* remove limite estreito herdado */
        }
        .layout-with-location.layout-right .location-maps-container .location-map { width: 220px; }

        /* Quando legenda está acima dos mapas */
        .layout-with-location.layout-right.legend-above .legend-preview {
            align-self: start;
        }

        .layout-with-location.layout-right.legend-above .location-maps-container {
            align-self: end;
        }

        /* Quando legenda está abaixo dos mapas */
        .layout-with-location.layout-right.legend-below .legend-preview {
            align-self: end;
        }

        .layout-with-location.layout-right.legend-below .location-maps-container {
            align-self: start;
        }

        .layout-with-location.layout-right .preview-footer {
            grid-column: 1 / -1;
            grid-row: 4; /* footer após os mapas de localização */
        }

        /* Layout com mapas de localização + legenda à direita pequena (mapas embaixo da legenda) */
        .layout-with-location.layout-right.legend-small {
            grid-template-columns: 1fr auto;
            grid-template-rows: auto 1fr auto auto;
        }

        .layout-with-location.layout-right.legend-small .preview-title {
            grid-column: 1 / -1;
            grid-row: 1;
        }

        .layout-with-location.layout-right.legend-small .map-preview {
            grid-column: 1;
            grid-row: 2;
            width: 100%;
            height: 500px;
            min-height: 500px;
            max-height: 500px;
        }

        .layout-with-location.layout-right.legend-small .legend-preview {
            grid-column: 2;
            grid-row: 2;
            position: relative;
            bottom: auto;
            right: auto;
            max-width: none !important;
            max-height: 500px;
            width: 100%;
            align-self: start;
            border: 3px solid orange;
        }

        .layout-with-location.layout-right.legend-small .location-maps-container {
            grid-column: 1;
            grid-row: 3;
            align-self: start;
            display: flex;
            flex-direction: row;
            justify-content: center; /* centraliza também no modo legend-small */
            align-items: flex-start;
            gap: 10px;
            width: 100%;
            max-width: none;
        }
        .layout-with-location.layout-right.legend-small .location-maps-container .location-map { width: 220px; }

        .layout-with-location.layout-right.legend-small .preview-footer {
            grid-column: 1 / -1;
            grid-row: 3;
        }

        /* Layout com mapas de localização + legenda dentro (inside) - mantém comportamento padrão */
        .layout-with-location.layout-inside {
            grid-template-columns: auto 1fr;
            grid-template-rows: auto 1fr auto;
        }

        .layout-with-location.layout-inside .preview-title {
            grid-column: 1 / -1;
            grid-row: 1;
        }

        .layout-with-location.layout-inside .location-maps-container {
            grid-column: 1;
            grid-row: 2;
            align-self: center;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .layout-with-location.layout-inside .map-preview {
            grid-column: 2;
            grid-row: 2;
            width: 100%;
            height: 500px;
            min-height: 500px;
            max-height: 500px;
            position: relative;
        }

        .layout-with-location.layout-inside .legend-preview {
            grid-column: 2;
            grid-row: 2;
            position: absolute;
            bottom: 19%;
            right: 15px;
            max-width: 400px;
            min-width: 200px;
            max-height: 60%;
            min-height: 100px;
            overflow-y: auto;
            z-index: 1000;
            width: auto;
            cursor: move;
            border: 3px solid orange;
        }

        .layout-with-location.layout-inside .preview-footer {
            grid-column: 1 / -1;
            grid-row: 3;
        }

        /* Responsividade para mapas de localização */
        @media (max-width: 1200px) {
            .layout-with-location {
                grid-template-columns: 1fr;
                grid-template-rows: auto auto 1fr auto;
            }

            .layout-with-location .location-maps-container {
                grid-column: 1;
                grid-row: 2;
                max-width: 100%;
                flex-direction: row;
                overflow-x: auto;
            }

            .layout-with-location .map-preview {
                grid-column: 1;
                grid-row: 3;
            }

            .layout-with-location .legend-preview {
                grid-column: 1;
                grid-row: 3;
            }

            .location-map {
                min-width: 200px;
                flex-shrink: 0;
            }
        }

        /* Estilos para drag and drop na legenda */
        .legend-item {
            cursor: move;
            user-select: none;
        }

        .legend-item.dragging {
            opacity: 0.5;
        }

        .legend-item.drag-over {
            border-top: 2px solid #3498db;
        }

        /* Estilos para controle de camadas */
        .layer-control-item {
            display: flex;
            align-items: center;
            padding: 8px;
            margin-bottom: 5px;
            border-bottom: 1px solid #eee;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .layer-control-item:hover {
            background-color: #f8f9fa;
        }

        .layer-control-item label {
            margin-left: 8px;
            cursor: pointer;
            flex: 1;
            font-size: 12px;
            color: #333;
            word-wrap: break-word;
        }

        .layer-control-item input[type="checkbox"] {
            cursor: pointer;
            margin-right: 5px;
            flex-shrink: 0;
        }

        .layer-control-item .layer-name {
            font-weight: 500;
            color: #2c3e50;
        }

        .layer-control-item .layer-type {
            font-size: 10px;
            color: #7f8c8d;
            margin-left: 5px;
        }

        /* Estilos para inputs de cor */
        input[type="color"] {
            width: 100%;
            height: 35px;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            padding: 2px;
        }

        input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
        }

        input[type="color"]::-webkit-color-swatch {
            border: none;
            border-radius: 3px;
        }

.preview-title {
    color: black;
    padding: 8px 10px;
    text-align: center;
    font-family: 'Georgia', serif;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    line-height: 1.2;
    min-height: 0;
}

/* Estilo específico para o container do título com logo */
.preview-title > div {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

/* Ajuste responsivo para telas menores */
@media (max-width: 768px) {
    .preview-title > div {
        flex-direction: column;
        gap: 8px;
    }
    
    .preview-title > div img {
        height: 30px !important;
    }
}

.location-map .leaflet-control-graphicscale {
            transform: scale(0.75);
            transform-origin: bottom left;
        }
        .location-map .leaflet-control-graphicscale-inner .label {
            font-size: 9px;
        }
 
.location-map .leaflet-graticule-line {
            stroke-width: 0.6px;
            stroke-dasharray: 2, 2;
            opacity: 0.5;
            font-size: 10px;
        }



.leaflet-tooltip.map-label {
    display: none !important; /* Oculto por padrão */
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    font-weight: bold;
    color: #333;
    font-size: 12px;
    padding: 2px 5px;
}

/* Remove a seta padrão do Leaflet tooltip */
.leaflet-tooltip.map-label::before {
    display: none;
}

/* Mostra os rótulos quando o checkbox for ativado */
body.show-map-labels .leaflet-tooltip.map-label {
    display: block !important;
}
    </style>
</head>
<body>
  

    <div id="exportModal" class="export-modal">
        <div class="export-modal-content">
            <div class="modal-header">
                <h2>🗺️ Configurar Exportação do Mapa</h2>
                <span class="close-modal" onclick="closeExportModal()">&times;</span>
            </div>

            <div class="modal-body">
                <div class="controls-panel">
                    <div class="control-group">
                        <h3>📝 Textos do Mapa</h3>
                        <div class="control-option">
                            <label>Título do Mapa:</label>
                            <input type="text" id="mapTitleInput" value="" 
                                   onchange="updateMapTitle()" style="width: 100%; padding: 8px; margin-top: 5px;">
                        </div>
                        <div class="control-option">
                            <label>Autoria:</label>
                            <input type="text" id="authorNameInput" value="" 
                                   onchange="updateAuthorName()" style="width: 100%; padding: 8px; margin-top: 5px;">
                        </div>
                        <div class="control-option">
                            <label>Responsavel Técnico:</label>
                            <input type="text" id="authorTecInput" value="" 
                                   onchange="updateAuthorTec()" style="width: 100%; padding: 8px; margin-top: 5px;">
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>📥 Formato</h3>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="exportFormat" value="png" checked>
                                PNG
                            </label>
                        </div>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="exportFormat" value="pdf">
                                PDF                               
                            </label>
                             <span style="font-size: 12px; color: red;">para mapas com muitos dados na legenda é recomendado o PNG</span>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>📋 Papel</h3>
                        <div class="format-options">
                            <div class="format-option">
                                <label>Tamanho:</label>
                                <select id="paperSize">
                                    <option value="A4" selected>A4</option>
                                    <option value="A3">A3</option>
                                    <option value="Letter">Letter</option>
                                </select>
                            </div>
                            
                            <div class="format-option">
                                <label>Orientação:</label>
                                <select id="orientation">
                                    <option value="landscape" selected>Paisagem</option>
                                    <option value="portrait">Retrato</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>🎯 Qualidade</h3>
                        <div class="control-option">
                            <label>DPI:</label>
                            <input type="number" id="dpi" value="300" min="72" max="600" step="72">
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>📍 Posição da Legenda</h3>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="legendPosition" value="inside" checked onchange="updatePreview()">
                                Dentro do Mapa
                            </label>
                        </div>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="legendPosition" value="right" onchange="updatePreview()">
                                Lado Direito
                            </label>
                        </div>
                        <div class="control-option" id="legendWidthInfo" style="display: none; margin-top: 15px; padding: 8px; background: #f0f0f0; border-radius: 4px; font-size: 11px; color: #666;">
                            <strong>💡 Dica:</strong> Arraste a borda esquerda da legenda para ajustar sua largura e o tamanho do mapa.
                        </div>
                        <div class="control-option" id="legendRightPositionGroup" style="display: none; margin-left: 20px;">
                            
                        </div>
                        <div class="control-option" id="legendRightPositionGroup2" style="display: none; margin-left: 20px;">
                                                   </div>

                        <div class="control-option">
                            <label>
                                <input type="radio" name="legendPosition" value="bottom" onchange="updatePreview()">
                                Abaixo do Mapa
                            </label>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>🎨 Formatação da legenda</h3>
                        
                        <div class="format-options">
                            <div class="format-option">
                                <label>Colunas:</label>
                                <select id="legendColumns" onchange="updatePreview()">
                                    <option value="1">1 Coluna</option>
                                    <option value="2">2 Colunas</option>
                                    <option value="3">3 Colunas</option>
                                    <option value="4">4 Colunas</option>
                                    <option value="5">5 Colunas</option>
                                    <option value="6">6 Colunas</option>
                                </select>
                            </div>
                            
                            <div class="format-option">
                                <label>Fonte (px):</label>
                                <select id="legendFontSize" onchange="updatePreview()">
                                    <option value="8">8 px</option>
                                    <option value="10">10 px</option>
                                    <option value="12" selected>12 px</option>
                                    <option value="14">14 px</option>
                                    <option value="16">16 px</option>
                                    <option value="18">18 px</option>
                                </select>
                            </div>

                            <br>
                            
                            <div class="format-option">
                                <label>Espaçamento:</label>
                                <select id="legendSpacing" onchange="updatePreview()">
                                    <option value="very-compact">Muito Compacto</option>
                                    <option value="compact">Compacto</option>
                                    <option value="normal" selected>Normal</option>
                                    <option value="loose">Amplo</option>
                                    <option value="very-loose">Muito Amplo</option>
                                </select>
                            </div>
                        </div>
                        
                        
                    </div>

                    

                    


                    <div class="control-group">
                        <h3>🗺️ Controle de Camadas</h3>
                        <div id="layersControl" style="max-height: 300px; overflow-y: auto;">
                            </div>

                            <div class="control-group">
                        <h3>Exibição</h3>
                        <div class="control-option">
                            <label>
                                <input type="checkbox" id="toggleMapLabels"> Mostrar nomes no mapa
                            </label>
                        </div>
                    </div>

                        <h3>🗺️ Camada Base</h3>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="baseLayer" value="osm" onchange="changeBaseLayer()">
                                OpenStreetMap
                            </label>
                        </div>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="baseLayer" value="carto" checked onchange="changeBaseLayer()">
                                CartoDB (Atual)
                            </label>
                        </div>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="baseLayer" value="satellite" onchange="changeBaseLayer()">
                                Satélite (Google)
                            </label>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>📍 Mapas de Localização</h3>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="locationMaps" value="0" checked onchange="updateLocationMaps()">
                                Nenhum
                            </label>
                        </div>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="locationMaps" value="1" onchange="updateLocationMaps()">
                                1 Mapa
                            </label>
                        </div>
                        <div class="control-option">
                            <label>
                                <input type="radio" name="locationMaps" value="2" onchange="updateLocationMaps()">
                                2 Mapas
                            </label>
                        </div>
                    </div>

              
                    <div class="control-group" id="locationSelectGroup" style="display: none;">
                        <h3>🗺️ Localização</h3>
                        
                        <!-- Para Mapa 1 (quando 1 mapa está selecionado) -->
                        <div id="map1Controls" style="display: none;">
                            <div class="format-option">
                                <label>Estado (Mapa 1):</label>
                                <select id="stateSelectMap1" onchange="onStateChangeMap1()">
                                    <option value="">Selecione um estado</option>
                                </select>
                            </div>
                            <div class="format-option" id="municipalitySelectWrapperMap1" style="display: none;">
                                <label>Município (Mapa 1):</label>
                                <select id="municipalitySelectMap1" onchange="updateLocationMap1(); updatePreview();">
                                    <option value="">Selecione um município</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Para Mapa 2 (quando 2 mapas estão selecionados) -->
                        <div id="map2Controls" style="display: none;">
                            <div class="format-option">
                                <label>Estado (Mapa 2):</label>
                                <select id="stateSelect" onchange="onStateChange()">
                                    <option value="">Selecione um estado</option>
                                </select>
                            </div>
                            <div class="format-option" id="municipalitySelectWrapper" style="display: none;">
                                <label>Município (Mapa 2):</label>
                                <select id="municipalitySelect" onchange="updateLocationMap2();  updatePreview();">
                                    <option value="">Selecione um município</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Adicione o checkbox "Adicionar Malha Municipal" -->
                    <div class="control-group" id="municipalMeshGroup" style="display: none;">
                        <h3>🏘️ Camadas de Localização</h3>
                            <!--<div class="control-option">
                                <label>
                                    <input type="checkbox" id="addBrasilToLegend" onchange="updateLocationLegendItems()">
                                    Adicionar Brasil à legenda
                                </label>
                            </div> -->
                            
                            <div class="control-option">
                                <label>
                                    <input type="checkbox" id="addEstadoToLegend" onchange="updateLocationLegendItems()">
                                    Adicionar Estado à legenda
                                </label>
                            </div>
                            
                            <div class="control-option">
                                <label>
                                    <input type="checkbox" id="addMunicipalMesh" onchange="toggleMunicipalMesh()">
                                    Adicionar malha municipal ao mapa e legenda
                                </label>
                            </div>
                    </div>

                    <div class="control-group" id="colorsSelectGroup" style="display: none;">
                        <h3>🎨 Cores</h3>
                        <!--<div class="format-option">
                            <label>Cor do Brasil:</label>
                            <input type="color" id="brasilColor" value="#D9E6A4" onchange="updateLocationColors();">
                        </div> -->
                        <div class="format-option">
                            <label>Cor do Estado:</label>
                            <input type="color" id="estadoColor" value="#F7C986" onchange="updateLocationColors();">
                        </div>
                        <div class="format-option" id="municipioColorWrapper" style="display: none;">
                            <label>Cor do Município:</label>
                            <input type="color" id="municipioColor" value="#E6A4A4" onchange="updateLocationColors();">
                        </div>
                    </div>
                </div>

                <div class="preview-area">
                     
                    <div id="previewContainer" class="preview-container layout-inside">
                        <div class="preview-title" id="previewTitle"></div>
                        <div class="location-maps-container hidden" id="locationMapsContainer">
                            <div class="location-map hidden" id="locationMap1">
                                <div id="mapLoc1Leaflet" style="width: 100%; height: 100%; position: relative;"></div>
                            </div>
                            <div class="location-map hidden" id="locationMap2">
                                <div id="mapLoc2Leaflet" style="width: 100%; height: 100%; position: relative;"></div>
                            </div>
                        </div>
                        <div class="map-preview" id="previewMap">
                            <div id="mapPreviewLeaflet" style="width: 100%; height: 100%; position: relative;"></div>
                        </div>
                        <div id="legendContainer" class="legend-preview">
                            <h4>Legenda</h4>
                            <div id="legendItems" class="legend-columns-1">
                                </div>
                            <div class="legend-resize-handle"></div>
                        </div>
                        <div class="preview-footer">
                            <div class="footer-text">
                                <p></p>
                                <p id="autorTec"></p>
                                <p class="copyright">Mapa criado através do ReatCarto ®</p>
                                <p>Bases Cartográficas: @OpenStreetMaps - Google Satélite - Leaflet</p>
                                <p>Núcleo de Ensino, Pesquisa e Extensão (R)ExistÊncias Ambientais e Territoriais - (R)EAT</p>
                                <p>Universidade Federal do Rio Grande - FURG</p>
                            </div>
                            <div class="footer-logo">
                                <img src="img/logoreat.png" alt="Logo REAT">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="loadingExport" class="loading">
                <div class="spinner"></div>
                <p>Gerando seu mapa...</p>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeExportModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="updatePreview()">📄 Atualizar Preview</button>
                <button class="btn btn-success" onclick="exportMap()">💾 Exportar Mapa</button>
            </div>
        </div>
    </div>

 <script src="js/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="js/Leaflet.GraphicScale.min.js"></script>
<script src="js/L.AutoGraticule.js"></script>
    <script>
        // =========================================================================
        // VARIÁVEIS GLOBAIS
        // =========================================================================
        
        // --- Mapas Leaflet ---
       
        var mapPreview; // O mapa de pré-visualização dentro do modal
        var previewOverlayGroup = null; // Grupo para camadas do preview (evita recriações)
        var previewControlsInitialized = false; // Evita adicionar controles duplicados
        var modalCleanupBound = false; // Evita vincular handlers de fechamento repetidamente
        let mapLoc1 = null; // Mapa de localização 1 (Brasil)
        let mapLoc2 = null; // Mapa de localização 2 (Estado/Município)

        // --- Dados e Camadas ---
        let markersData = []; // Armazena os dados dos marcadores (pontos, linhas, etc.)
        let tipooverLayers = {}; // Grupos de camadas por 'Tipo'
        let overLayers = {}; // Grupos de camadas por 'Nome'
        let currentBaseLayer = null; // Camadas de base (ex: OpenStreetMap)
        let legendItems = []; // Itens para construir a legenda
        
        // --- Camadas GeoJSON de Fundo ---
        let municipioGeoJSONLayer = null; // Referência à camada do município no MAPA PRINCIPAL
        let estadoGeoJSONLayer = null; // Referência à camada do estado no MAPA PRINCIPAL
        let municipioAtual = null; // Código (CD_MUN) do município selecionado
        
        // --- Dados GeoJSON Carregados ---
        let brasilGeoJSON = null;
        let estadosGeoJSON = null;
        let municipiosGeoJSON = null;
        let estadosList = [];
        let municipiosList = [];
        let locationColorItems = [];

        async function fetchMunicipiosGeoJSON(cd_uf) {
            const response = await fetch(`dataservice/get_municipios.php?cd_uf=${encodeURIComponent(cd_uf)}`, {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('Erro ao carregar municípios');
            }
            return response.json();
        }

        // --- Outros ---
        let mapTitleText = ''; // Título padrão do mapa

        let locationPolygon1 = null; // Polígono no mapa de localização 1
        let locationPolygon2 = null; // Polígono no mapa de localização 2
        let locationPolygon3 = null; // Polígono no mapa de localização 2

        // =========================================================================
        // INICIALIZAÇÃO DO MAPA PRINCIPAL
        // =========================================================================


        /**
 * Atualiza o título do mapa quando o usuário digita
 */
function updateMapTitle() {
    const titleInput = document.getElementById('mapTitleInput');
    const previewTitle = document.getElementById('previewTitle');
    
    if (titleInput && previewTitle) {
        previewTitle.textContent = titleInput.value.trim();
    }
}

/**
 * Atualiza o nome do autor quando o usuário digita
 */
function updateAuthorTec() {
    const authorTecInput = document.getElementById('authorTecInput');
    const authorTecElement = document.getElementById('autorTec');
    
    if (authorTecInput && authorTecElement) {
        const valor = authorTecInput.value.trim();
        authorTecElement.textContent = valor ? `Responsável Técnico: ${valor}` : '';
    }
}

function updateAuthorName() {
    const authorInput = document.getElementById('authorNameInput');
    const authorElement = document.querySelector('.preview-footer p:first-child');
    
    if (authorInput && authorElement) {
        const valor = authorInput.value.trim();
        authorElement.textContent = valor ? `Autoria: ${valor}` : '';
    }
}
/**
 * Inicializa os valores dos campos de texto
 */
function initializeTextInputs() {
    const previewTitle = document.getElementById('previewTitle');
    const authorElement = document.querySelector('.preview-footer p:first-child');
    const authorTecElement =  document.getElementById('autorTec');
    const titleInput = document.getElementById('mapTitleInput');
    const authorInput = document.getElementById('authorNameInput');
    const authorTecInput = document.getElementById('authorTecInput');


    if (titleInput && previewTitle) {
        titleInput.value = previewTitle.textContent;
    }
    
    if (authorInput && authorElement) {
        const authorText = authorElement.textContent.replace('Autoria: ', '');
        authorInput.value = authorText;
    }

    if (authorTecInput && authorTecElement) {
        const authorTecText = authorTecElement.textContent.replace('Responsavel Técnico: ', '');
        authorTecInput.value = authorTecText;
    }
}



           

function closeWindowAndCleanup() {
    // Limpa os recursos do mapa de preview antes de fechar a janela
    cleanupMapPreview(); 
    // Fecha a janela que foi aberta (geralmente via window.open)
    window.close(); 
}


function initializeWindowActions() {
    // Ação do botão 'X' (close-modal)
    const closeButton = document.querySelector('.close-modal');
    if (closeButton) {
        closeButton.onclick = closeWindowAndCleanup;
    }
    // Ação do botão 'Cancelar' (btn-secondary)
    const cancelButton = document.querySelector('.modal-actions .btn-secondary');
    if (cancelButton) {
        cancelButton.onclick = closeWindowAndCleanup;
    }
}
        // =========================================================================
        // CARREGAMENTO DE DADOS (PONTOS, LINHAS, POLÍGONOS)
        // =========================================================================

        /**
         * Busca os dados GeoJSON (pontos/linhas/polígonos do usuário) do backend.
         */
     // No código original, procure por esta função e remova ou comente a chamada processGeoJSON
function loadMapData() {
    fetch('./dataservice/get_points.php')
        .then(response => response.json())
        .then(data => {
            console.log('Dados carregados:', data);
            // processGeoJSON(data); // REMOVER OU COMENTAR ESTA LINHA
        })
        .catch(error => console.error('Erro ao carregar dados:', error));
}

function changeBaseLayer() {
    if (!mapPreview) return;
    
    const selectedLayer = document.querySelector('input[name="baseLayer"]:checked')?.value;
    
    // Remove a camada base atual
    if (currentBaseLayer) {
        mapPreview.removeLayer(currentBaseLayer);
    }
    
    // Adiciona a nova camada base
    switch(selectedLayer) {
        case 'osm':
            currentBaseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapPreview);
            break;
            
        case 'satellite':
            currentBaseLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google'
            }).addTo(mapPreview);
            break;
            
        case 'carto':
        default:
            currentBaseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
                attribution: '© CartoDB'
            }).addTo(mapPreview);
            break;
    }
    
    console.log('Camada base alterada para:', selectedLayer);
}
        /**
         * Processa o GeoJSON recebido.
         * 1. Adiciona a camada de fundo (Estado/Município) ao mapa principal.
         * 2. Itera sobre cada 'feature' (ponto, linha, polígono do usuário).
         * 3. Cria os itens de legenda (legendItems).
         * 4. Cria as camadas (overLayers, tipooverLayers) e as adiciona ao mapa principal.
         * 5. Atualiza o controle de camadas no modal.
         */
       

       /**
         * Adiciona/Atualiza as camadas de fundo (Estado e Município) ao MAPA PRINCIPAL.
         * Esta função é chamada na carga inicial e sempre que o estado, município ou cores são alterados.
         *
         * ATUALIZADO (Conforme solicitado): 
         * Esta função agora APENAS remove as camadas antigas do mapa principal
         * e atualiza a variável 'municipioAtual'. A adição das camadas
         * ao mapa de PREVIEW é feita exclusivamente por 'updateMapPreview()'.
         *
        */

function toggleMunicipalMesh() {
    const checkbox = document.getElementById('addMunicipalMesh');
    const isChecked = checkbox.checked;
    
    if (isChecked) {
        // Adiciona a malha municipal ao mapa preview
        addMunicipalMeshToPreview();
    } else {
        // Remove a malha municipal do mapa preview
        removeMunicipalMeshFromPreview();
    }
    
    // Atualiza os itens de localização na legenda
    updateLocationLegendItems();
    
    // ADICIONAR: Força atualização do layout
    setTimeout(() => {
        updatePreviewLayout();
        if (mapPreview) mapPreview.invalidateSize();
    }, 100);
}

let municipalMeshLayer = null; // Variável global para armazenar a camada

async function addMunicipalMeshToPreview() {
    if (!mapPreview) return;
    
    // Determina qual município usar (do Mapa 1 ou Mapa 2)
    const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked')?.value || 0);
    let cd_mun, cd_uf;
    
    if (numMaps === 1) {
        const stateSelectMap1 = document.getElementById('stateSelectMap1');
        const municipioSelectMap1 = document.getElementById('municipalitySelectMap1');
        cd_uf = stateSelectMap1?.value;
        cd_mun = municipioSelectMap1?.value;
    } else if (numMaps === 2) {
        const stateSelect = document.getElementById('stateSelect');
        const municipioSelect = document.getElementById('municipalitySelect');
        cd_uf = stateSelect?.value;
        cd_mun = municipioSelect?.value;
    }
    

    
    try {
        const estado = estadosList.find(e => e.cd_uf === cd_uf);
        if (!estado) return;
        
        const municipiosData = await fetchMunicipiosGeoJSON(cd_uf);
        
        const municipioFeature = municipiosData.features.find(f => f.properties.CD_MUN === cd_mun);
        if (!municipioFeature) {
            console.error('Município não encontrado');
            return;
        }
        
        const municipioColorInput = document.getElementById('municipioColor');
        const municipioColor = municipioColorInput?.value || '#E6A4A4';
        
        // Remove camada anterior se existir
        if (municipalMeshLayer) {
            mapPreview.removeLayer(municipalMeshLayer);
        }
        
        // Adiciona a nova camada
        municipalMeshLayer = L.geoJSON(municipioFeature, {
            style: {
                color: municipioColor,
                fillColor: municipioColor,
                fillOpacity: 0,
                opacity: 1,
                weight: 4
            }
        }).addTo(mapPreview);
        
        // ADICIONAR: Move o mapa para o município
        mapPreview.fitBounds(municipalMeshLayer.getBounds(), { padding: [50, 50] });
        
        console.log('Malha municipal adicionada ao preview com cor:', municipioColor);
        
    } catch (error) {
        console.error('Erro ao adicionar malha municipal:', error);
        alert('Erro ao carregar a malha municipal.');
        document.getElementById('addMunicipalMesh').checked = false;
    }
}

function removeMunicipalMeshFromPreview() {
    if (municipalMeshLayer && mapPreview) {
        mapPreview.removeLayer(municipalMeshLayer);
        municipalMeshLayer = null;
        console.log('Malha municipal removida do preview');
    }
}

// Adicione esta função (após linha ~1300):
function updateLocationLegendItems() {
    // Limpa os itens de localização anteriores
    locationColorItems = [];
    
    const addBrasil = document.getElementById('addBrasilToLegend')?.checked || false;
    const addEstado = document.getElementById('addEstadoToLegend')?.checked || false;
    const addMunicipio = document.getElementById('addMunicipalMesh')?.checked || false;
    
    const brasilColorInput = document.getElementById('brasilColor');
    const estadoColorInput = document.getElementById('estadoColor');
    const municipioColorInput = document.getElementById('municipioColor');
    
    const brasilColor = brasilColorInput?.value || '#D9E6A4';
    const estadoColor = estadoColorInput?.value || '#F7C986';
    const municipioColor = municipioColorInput?.value || '#E6A4A4';
    
    // Adiciona Brasil à legenda se marcado
    if (addBrasil && brasilGeoJSON) {
        locationColorItems.push({
            tipo: 'Brasil',
            nome: 'Brasil',
            geometry: 'Polygon',
            color: brasilColor,
            fillColor: brasilColor,
            isLocationColor: true,
            properties: {
                color: brasilColor,
                fillColor: brasilColor
            }
        });
    }
    
    // Adiciona Estado à legenda se marcado
    if (addEstado) {
        const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked')?.value || 0);
        let stateSelect;
        
        if (numMaps === 1) {
            stateSelect = document.getElementById('stateSelectMap1');
        } else {
            stateSelect = document.getElementById('stateSelect');
        }
        
        const cd_uf = stateSelect?.value;
        
        if (cd_uf && estadosGeoJSON) {
            const estadoFeature = estadosGeoJSON.features.find(f => f.properties.CD_UF === cd_uf);
            if (estadoFeature) {
                const estadoNome = estadoFeature.properties.NM_UF || 'Estado';
                locationColorItems.push({
                    tipo: estadoNome,
                    nome: estadoNome,
                    geometry: 'Polygon',
                    color: estadoColor,
                    fillColor: estadoColor,
                    isLocationColor: true,
                    properties: {
                        color: estadoColor,
                        fillColor: estadoColor
                    }
                });
            }
        }
    }
    
    // Adiciona Município à legenda se marcado
    if (addMunicipio) {
        const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked')?.value || 0);
        let municipioSelect;
        
        if (numMaps === 1) {
            municipioSelect = document.getElementById('municipalitySelectMap1');
        } else {
            municipioSelect = document.getElementById('municipalitySelect');
        }
        
        const cd_mun = municipioSelect?.value;
        const municipioText = municipioSelect?.options[municipioSelect.selectedIndex]?.text;
        
        if (cd_mun && municipioText && municipioText !== 'Selecione um município') {
            locationColorItems.push({
                tipo: municipioText,
                nome: municipioText,
                geometry: 'Polygon',
                color: municipioColor,
                fillColor: municipioColor,
                isLocationColor: true,
                properties: {
                    color: municipioColor,
                    fillColor: municipioColor
                }
            });
        }
    }
    
    console.log('Itens de localização atualizados:', locationColorItems);
    
    // *** IMPORTANTE: Chama a função corrigida que atualiza apenas os itens de localização ***
    updateLegendLocationItems();
}

function updateLegendLocationItems() {
    const container = document.getElementById('legendItems');
    if (!container) return;

    // Remove APENAS os itens de localização antigos
    const oldLocationItems = container.querySelectorAll('.location-color-item');
    oldLocationItems.forEach(item => item.remove());

    // Adiciona os novos itens de localização NO FINAL
    locationColorItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'legend-item location-color-item';
        div.draggable = true;
        div.dataset.tipo = item.tipo;
        div.dataset.geometry = item.geometry;
        div.style.marginTop = '6px';

        // Símbolo para localização
        const symbol = document.createElement('div');
        symbol.className = 'legend-symbol';

        const fillColor = item.properties?.fillColor || item.fillColor || item.color || '#27ae60';
        const color = item.properties?.color || item.color || '#1e5631';
        // Legend uses a fixed border weight matching the line symbol for visual consistency
        const weight = 3;
        const dash = item.properties?.dashArray;
        const dashAttr = dash ? ` stroke-dasharray="${Array.isArray(dash) ? dash.join(',') : dash}"` : '';
        const m2 = Math.ceil(weight / 2) + 1;
        const rW2 = 36 - m2 * 2, rH2 = 24 - m2 * 2; // Increased height to 24px
        symbol.innerHTML = `<svg width="36" height="24"><rect x="${m2}" y="${m2}" width="${rW2}" height="${rH2}" fill="${fillColor}" stroke="${color}" stroke-width="${weight}" stroke-linejoin="round"${dashAttr} /></svg>`;

        // Label
        const label = document.createElement('span');
        label.className = 'legend-label';
        label.textContent = item.nome || item.tipo;

        div.appendChild(symbol);
        div.appendChild(label);
        
        container.appendChild(div);
    });

    // Re-configura drag and drop para os novos itens
    setupLegendDragAndDrop();
}


// =========================================================================
// GERENCIAMENTO DE MEMÓRIA - REMOVER CAMADAS DO MAPA PRINCIPAL
// =========================================================================

let originalOverLayers = {}; // Armazena referências das camadas
let originalTipoOverLayers = {}; // Armazena referências das camadas por tipo
let isModalOpen = false; // Flag para controlar se modal está aberto

/**
 * Remove todas as camadas do mapa principal para liberar memória
 * quando o modal de exportação é aberto
 */
function removeMainMapLayers() {
    console.log('Removendo camadas do mapa principal para liberar memória...');
    
    // Remove todas as camadas do mapa principal (exceto a base)
    map.eachLayer(layer => {
        // Mantém apenas as camadas base (TileLayer)
        if (!(layer instanceof L.TileLayer) && 
            !(layer instanceof L.Control) &&
            layer.remove) {
            try {
                map.removeLayer(layer);
            } catch (e) {
                console.warn('Erro ao remover camada:', e);
            }
        }
    });

    // Limpa referências das camadas para liberar memória
    originalOverLayers = {};
    originalTipoOverLayers = {};
    
    // Força coleta de lixo (se disponível)
    if (window.gc) {
        window.gc();
    }
}

/**
 * Restaura todas as camadas do mapa principal quando o modal é fechado
 */
function restoreMainMapLayers() {
    console.log('Restaurando camadas do mapa principal...');
    
    // Re-adiciona as camadas de tipo (grupos)
    for (const groupTipo in tipooverLayers) {
        if (tipooverLayers[groupTipo] && !map.hasLayer(tipooverLayers[groupTipo])) {
            map.addLayer(tipooverLayers[groupTipo]);
        }
    }

    // Re-adiciona as camadas por nome
    for (const groupName in overLayers) {
        if (overLayers[groupName] && !map.hasLayer(overLayers[groupName])) {
            map.addLayer(overLayers[groupName]);
        }
    }
    
    // Força redraw do mapa
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}



        // =========================================================================
        // CARREGAMENTO DE GEOJSONS (BRASIL, ESTADOS, MUNICÍPIOS)
        // =========================================================================

        /**
         * Carrega os arquivos GeoJSON (Brasil, Estados, Municípios) e preenche o dropdown de estados.
         */
       async function loadGeoJSONs() {
    try {
        // Carrega Brasil
        const brasilResponse = await fetch('data/brasil.geojson');
        brasilGeoJSON = await brasilResponse.json();

        // Carrega estados
        const estadosResponse = await fetch('data/estados.geojson');
        estadosGeoJSON = await estadosResponse.json();
        
        // Extrai lista de estados
        estadosList = estadosGeoJSON.features.map(feature => ({
            cd_uf: feature.properties.CD_UF,
            nm_uf: feature.properties.NM_UF,
            sigla_uf: feature.properties.SIGLA_UF
        })).sort((a, b) => a.nm_uf.localeCompare(b.nm_uf));
        
        // Preenche AMBOS os selects de estado
        const stateSelect = document.getElementById('stateSelect'); // Mapa 2
        const stateSelectMap1 = document.getElementById('stateSelectMap1'); // Mapa 1
        
        estadosList.forEach(estado => {
            const option1 = document.createElement('option');
            option1.value = estado.cd_uf;
            option1.textContent = `${estado.nm_uf} (${estado.sigla_uf})`;
            stateSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = estado.cd_uf;
            option2.textContent = `${estado.nm_uf} (${estado.sigla_uf})`;
            stateSelectMap1.appendChild(option2);
        });

        municipiosGeoJSON = null;
        
    } catch (error) {
        console.error('Erro ao carregar GeoJSONs:', error);
    }
}
/**
 * Carrega os municípios do estado selecionado a partir do arquivo específico
 */
async function loadMunicipalitiesByStateForMap1(cd_uf) {
    const municipioSelectMap1 = document.getElementById('municipalitySelectMap1');
    const estado = estadosList.find(e => e.cd_uf === cd_uf);
    
    if (!estado) {
        console.error('Estado não encontrado:', cd_uf);
        return;
    }

    municipioSelectMap1.innerHTML = '<option value="">Carregando municípios...</option>';
    
    try {
        const municipiosData = await fetchMunicipiosGeoJSON(cd_uf);
        
        const municipiosDoEstado = municipiosData.features
            .filter(feature => feature.properties.CD_UF === cd_uf)
            .map(feature => ({
                cd_mun: feature.properties.CD_MUN,
                nm_mun: feature.properties.NM_MUN
            }))
            .sort((a, b) => a.nm_mun.localeCompare(b.nm_mun));
        
        municipioSelectMap1.innerHTML = '<option value="">Selecione um município</option>';
        
        municipiosDoEstado.forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio.cd_mun;
            option.textContent = municipio.nm_mun;
            municipioSelectMap1.appendChild(option);
        });
        
    } catch (error) {
        console.error('Erro ao carregar municípios:', error);
        municipioSelectMap1.innerHTML = '<option value="">Erro ao carregar municípios</option>';
    }
}

async function loadMunicipalitiesByState(cd_uf) {
    const municipioSelect = document.getElementById('municipalitySelect');
    const estado = estadosList.find(e => e.cd_uf === cd_uf);
    
    if (!estado) {
        console.error('Estado não encontrado:', cd_uf);
        return;
    }

    // Mostra loading
    municipioSelect.innerHTML = '<option value="">Carregando municípios...</option>';
    
    try {
        const municipiosData = await fetchMunicipiosGeoJSON(cd_uf);
        
        municipiosGeoJSON = municipiosData;
        console.log(`Municípios de ${estado.sigla_uf} carregados:`, municipiosGeoJSON.features.length);
        
        const municipiosDoEstado = municipiosGeoJSON.features
            .filter(feature => feature.properties.CD_UF === cd_uf)
            .map(feature => ({
                cd_mun: feature.properties.CD_MUN,
                nm_mun: feature.properties.NM_MUN
            }))
            .sort((a, b) => a.nm_mun.localeCompare(b.nm_mun));
        
        municipioSelect.innerHTML = '<option value="">Selecione um município</option>';
        
        municipiosDoEstado.forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio.cd_mun;
            option.textContent = municipio.nm_mun;
            municipioSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Erro ao carregar municípios do estado:', error);
        municipioSelect.innerHTML = '<option value="">Erro ao carregar municípios</option>';
        municipiosGeoJSON = null;
    }
}

        /**
         * Chamada quando o dropdown de Estado é alterado.
         * Atualiza o dropdown de municípios e os mapas de localização.
         * ATUALIZADO: Adiciona chamada a updateMapPreview() para atualização dinâmica.
         */
async function onStateChangeMap1() {
    const stateSelectMap1 = document.getElementById('stateSelectMap1');
    const municipioSelectMap1 = document.getElementById('municipalitySelectMap1');
    const municipioWrapperMap1 = document.getElementById('municipalitySelectWrapperMap1');
    const cd_uf = stateSelectMap1.value;
    
    municipioSelectMap1.innerHTML = '<option value="">Selecione um município</option>';
    
    if (cd_uf) {
        municipioWrapperMap1.style.display = 'block';
        await loadMunicipalitiesByStateForMap1(cd_uf);
    } else {
        municipioWrapperMap1.style.display = 'none';
    }
    
    updateLocationMap1();

   
    
    // ADICIONAR: Move o preview para o estado selecionado
    if (mapPreview && cd_uf && estadosGeoJSON) {
        const estadoFeature = estadosGeoJSON.features.find(f => f.properties.CD_UF === cd_uf);
        if (estadoFeature) {
            const tempLayer = L.geoJSON(estadoFeature);
            mapPreview.fitBounds(tempLayer.getBounds(), { padding: [50, 50] });
        }
    }
}




        async function onStateChange() {
    const stateSelect = document.getElementById('stateSelect');
    const municipioSelect = document.getElementById('municipalitySelect');
    const municipioWrapper = document.getElementById('municipalitySelectWrapper');
    const municipioColorWrapper = document.getElementById('municipioColorWrapper');
    const cd_uf = stateSelect.value;
    
    // Limpa select de municípios
    municipioSelect.innerHTML = '<option value="">Selecione um município</option>';
    
    // Mostra/oculta select de município
    const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked').value);
    
    if (numMaps === 2 && cd_uf) {
        municipioWrapper.style.display = 'block';
        municipioColorWrapper.style.display = 'block';
        
        // Carrega municípios do estado selecionado
        await loadMunicipalitiesByState(cd_uf);
    } else {
        municipioWrapper.style.display = 'none';
        municipioColorWrapper.style.display = 'none';
        
        // Reseta seleção de município
        municipioSelect.value = ""; 
        municipioAtual = null;
        municipiosGeoJSON = null; // Libera memória
    }
    
    // Atualiza mapas
    updateLocationMap1();
    if (numMaps === 2) {
        updateLocationMap1();
        updateLocationMap2();
    }



    // Atualiza o preview dinamicamente
    if (mapPreview) {
        updatePreview();
    }
}

        /**
         * Carrega os municípios no dropdown com base no estado (CD_UF) selecionado.
         */
        async function loadMunicipalities(cd_uf) {
    // Se não temos os municípios carregados ou é um estado diferente, carrega
    if (!municipiosGeoJSON || 
        (municipiosGeoJSON.features.length > 0 && 
         municipiosGeoJSON.features[0].properties.CD_UF !== cd_uf)) {
        await loadMunicipalitiesByState(cd_uf);
    } else {
        // Já temos os municípios carregados, apenas filtra
        const municipioSelect = document.getElementById('municipalitySelect');
        municipioSelect.innerHTML = '<option value="">Selecione um município</option>';
        
        const municipiosDoEstado = municipiosGeoJSON.features
            .filter(feature => feature.properties.CD_UF === cd_uf)
            .map(feature => ({
                cd_mun: feature.properties.CD_MUN,
                nm_mun: feature.properties.NM_MUN
            }))
            .sort((a, b) => a.nm_mun.localeCompare(b.nm_mun));
        
        // Preenche select
        municipiosDoEstado.forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio.cd_mun;
            option.textContent = municipio.nm_mun;
            municipioSelect.appendChild(option);
        });
    }
}

        /**
         * Chamada quando um input de cor (Brasil, Estado, Município) é alterado.
         * ATUALIZADO: Adiciona chamada a updateMapPreview() para atualização dinâmica.
         */
      function updateLocationColors() {
    updateLocationMap1();
    updateLocationMap2();
    
    const addMunicipalMesh = document.getElementById('addMunicipalMesh');
    if (addMunicipalMesh && addMunicipalMesh.checked) {
        if (municipalMeshLayer && mapPreview) {
            const municipioColorInput = document.getElementById('municipioColor');
            const municipioColor = municipioColorInput?.value || '#E6A4A4';
            
            municipalMeshLayer.setStyle({
                color: municipioColor,
                fillColor: municipioColor,
                fillOpacity: 0,
                opacity: 1,
                weight: 4
            });
            
            console.log('Cor da malha municipal atualizada para:', municipioColor);
        }
    }
    
    // *** CHAMA A FUNÇÃO CORRIGIDA ***
    updateLocationLegendItems();
    updateMapPreview();
}
        // =========================================================================
        // LÓGICA DO MODAL DE EXPORTAÇÃO
        // =========================================================================

        /**
         * Abre o modal de exportação e força a atualização dos controles.
         */




function initializeModalCleanup() {
    const closeButton = document.querySelector('.close-modal');
    if (closeButton) {
        closeButton.onclick = function() {
            closeExportModalEnhanced();
        };
    }
    
    const cancelButton = document.querySelector('.btn-secondary');
    if (cancelButton) {
        cancelButton.onclick = function() {
            closeExportModalEnhanced();
        };
    }
}
/**
 * Limpa o mapa preview quando o modal é fechado
 */
function cleanupMapPreview() {
    if (mapPreview) {
        mapPreview.remove();
        mapPreview = null;
    }
    
    if (mapLoc1) {
        mapLoc1.remove();
        mapLoc1 = null;
    }
    
    if (mapLoc2) {
        mapLoc2.remove();
        mapLoc2 = null;
    }

    // Reset flags e grupos para próximas aberturas
    previewOverlayGroup = null;
    previewControlsInitialized = false;
}


        /**
         * Carrega/Recarrega os itens na legenda (dentro do modal).
         * Inclui itens para os mapas de localização (Brasil, Estado, Município) se ativos.
         */
     function loadLegendItems() {
    const container = document.getElementById('legendItems');
    container.innerHTML = '';

    // Remove duplicatas dos dados do usuário (baseado no tipo, geometria, cor, etc.)
    const uniqueItems = [];
    const seenItems = new Set();

    legendItems.forEach(item => {
        const props = item.properties || {};
        const itemKey = `${item.tipo}-${item.geometry}-` +
                        `${props.color || item.color || ''}-` +
                        `${props.fillColor || item.fillColor || ''}-` +
                        `${item.icon_url || ''}-` +
                        `${props.weight || ''}-` +
                        (props.dashArray ? 
                            (Array.isArray(props.dashArray) ? props.dashArray.join(',') : props.dashArray) 
                            : '') +
                        `${props.Name || item.nome || ''}`;

        if (!seenItems.has(itemKey)) {
            seenItems.add(itemKey);
            uniqueItems.push(item);
        }
    });

    window.uniqueItems = uniqueItems;

    // *** IMPORTANTE: Adiciona APENAS os itens do usuário (SEM os de localização no início) ***
    const allItems = [...uniqueItems];

    // Cria os elementos HTML da legenda para dados do usuário
    allItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.draggable = true;
        div.dataset.index = index;

        const symbol = document.createElement('div');
        symbol.className = 'legend-symbol';

        const properties = item.properties || {};

        if (item.icon_url) {
            symbol.innerHTML = `<img src="${item.icon_url}" alt="${item.tipo}" style="width: 20px; height: 20px; object-fit: contain;">`;
        } else if (item.geometry === 'Point' || item.geometry === 'Circle') {
            const color = properties.fillColor || properties.color || item.color || '#3498db';
            const borderColor = properties.color || '#000';
            symbol.innerHTML = `<div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${color}; border: 2px solid ${borderColor};"></div>`;
        } else if (item.geometry === 'LineString') {
            // Legend uses a fixed, consistent stroke weight regardless of the real map weight
            const color = properties.color || item.color || '#2ecc71';
            const weight = 3;
            const dash = properties.dashArray;

            // Parse the raw dash pattern (values may be tiny on the real map and barely visible at legend scale)
            let dashParts = [];
            if (dash && Array.isArray(dash)) {
                dashParts = dash.map(Number).filter(n => !isNaN(n));
            } else if (dash && typeof dash === 'string') {
                dashParts = dash.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            }

            // Rescale the dash pattern so dashes/dots are clearly visible at legend size,
            // while preserving whether segments are "dash-like" or "dot-like" (relative to weight)
            let dashStr = '';
            let lineLen = 32;
            if (dashParts.length) {
                const minSegmentPx = 3; // smallest visible segment in the legend
                const scale = minSegmentPx / Math.min(...dashParts);
                const scaledParts = dashParts.map(n => Math.max(minSegmentPx, Math.round(n * scale)));
                dashStr = scaledParts.join(',');
                const cycle = scaledParts.reduce((a, b) => a + b, 0);
                lineLen = Math.max(32, cycle * 2);
            }
            const svgH = 16; // Slightly taller
            const cy = svgH / 2;
            const dashAttrLine = dashStr ? ` stroke-dasharray="${dashStr}"` : '';
            symbol.innerHTML = `<svg width="40" height="${svgH}" viewBox="0 0 ${lineLen + 4} ${svgH}" preserveAspectRatio="xMidYMid meet"><line x1="2" y1="${cy}" x2="${lineLen + 2}" y2="${cy}" stroke="${color}" stroke-width="${weight}" stroke-linecap="round"${dashAttrLine} /></svg>`;
        } else if (item.geometry === 'Polygon') {
            const fillColor = properties.fillColor || item.fillColor || item.color || '#27ae60';
            const fillOpacity = properties.fillOpacity !== undefined ? properties.fillOpacity : 0.7;
            const color = properties.color || item.color || '#1e5631';
            // Legend uses a fixed border weight matching the line symbol for visual consistency
            const weight = 3;
            const dash = properties.dashArray;
            const dashAttr = dash ? ` stroke-dasharray="${Array.isArray(dash) ? dash.join(',') : dash}"` : '';
            // Increased height to 24px, width to 36px for better visibility
            const m = Math.ceil(weight / 2) + 1;
            const rW = 36 - m * 2, rH = 24 - m * 2;
            symbol.innerHTML = `<svg width="36" height="24"><rect x="${m}" y="${m}" width="${rW}" height="${rH}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="${weight}" stroke-linejoin="round"${dashAttr} /></svg>`;
        } else {
            const color = properties.color || item.color || '#3498db';
            symbol.innerHTML = `<div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${color}; border: 2px solid #000;"></div>`;
        }

        const label = document.createElement('span');
        label.className = 'legend-label';
        
        let displayName = item.tipo;
        if (item.properties && item.properties.Name) {
            displayName = item.properties.Name;
        } else if (item.nome && item.nome !== 'Sem nome') {
            displayName = item.nome;
        }
        
        label.textContent = displayName;

        div.appendChild(symbol);
        div.appendChild(label);
        div.dataset.tipo = item.tipo;
        div.dataset.geometry = item.geometry;
        
        container.appendChild(div);
    });

    // *** AGORA ADICIONA os itens de localização no FINAL ***
    updateLegendLocationItems();
}
        // =========================================================================
        // LÓGICA DE PRÉ-VISUALIZAÇÃO (PREVIEW)
        // =========================================================================

       /**
         * Atualiza todo o layout da área de preview (posição da legenda, colunas, fontes, etc.).
         * Chama 'updateMapPreview()' para renderizar o mapa.
         *
         * ATUALIZADO: Lógica de inicialização/reset do drag-and-drop da legenda corrigida.
         */
     function updatePreview() {
    // Atualiza apenas o layout, não recarrega os dados
    updatePreviewLayout();
    
}

        /**
         * Configura o resize da legenda quando ela está à direita do mapa.
         * Permite redimensionar arrastando a borda esquerda da legenda.
         */
        let legendRightResizeInitialized = false;
        let isResizingLegendRight = false;
        let legendRightResizeStartX = 0;
        let legendRightResizeStartWidth = 0;
        let legendRightResizeContainer = null;
        
        // Utilitário: throttle baseado em requestAnimationFrame
        function rafThrottle(fn) {
            let running = false;
            let lastArgs;
            return function throttled(...args) {
                lastArgs = args;
                if (running) return;
                running = true;
                requestAnimationFrame(() => {
                    running = false;
                    fn(...lastArgs);
                });
            };
        }

        function setupLegendRightResize() {
            const legend = document.getElementById('legendContainer');
            const container = document.getElementById('previewContainer');
            if (!legend || !container) return;
            
            // Verifica se a legenda está realmente à direita
            const position = document.querySelector('input[name="legendPosition"]:checked')?.value;
            if (position !== 'right') {
                removeLegendRightResize();
                return;
            }
            
            // Remove handlers anteriores se existirem
            if (legendRightResizeInitialized) {
                removeLegendRightResize();
            }
            
            legendRightResizeInitialized = true;
            legendRightResizeContainer = container;
            
            // Cria handle de resize na borda esquerda se não existir
            let resizeHandleLeft = legend.querySelector('.legend-resize-handle-left');
            if (!resizeHandleLeft) {
                resizeHandleLeft = document.createElement('div');
                resizeHandleLeft.className = 'legend-resize-handle-left';
                legend.appendChild(resizeHandleLeft);
            }
            
            // Handler para iniciar o resize
            const startResize = function(e) {
                isResizingLegendRight = true;
                legend.classList.add('resizing');
                
                const containerRect = container.getBoundingClientRect();
                const legendRect = legend.getBoundingClientRect();
                
                legendRightResizeStartX = e.clientX;
                legendRightResizeStartWidth = legendRect.width;
                
                e.preventDefault();
                e.stopPropagation();
            };
            
            resizeHandleLeft.addEventListener('mousedown', startResize);
            
            // Handler global de movimento do mouse
            const mouseMoveHandler = rafThrottle(function(e) {
                if (!isResizingLegendRight) return;
                
                const containerRect = container.getBoundingClientRect();
                // deltaX é positivo quando arrastamos para a esquerda (aumenta legenda)
                // deltaX é negativo quando arrastamos para a direita (diminui legenda)
                const deltaX = legendRightResizeStartX - e.clientX;
                
                // Calcula a nova largura da legenda
                // Arrastar para a esquerda aumenta a largura da legenda
                const newLegendWidth = legendRightResizeStartWidth + deltaX;
                
                // Limites: mínimo e máximo baseados no tamanho do container e fonte
                const fontSize = document.getElementById('legendFontSize').value;
                const hasLocationMaps = container.classList.contains('layout-with-location');
                
                const minWidthByFont = {
                    '8': hasLocationMaps ? 180 : 200,
                    '10': hasLocationMaps ? 200 : 220,
                    '12': hasLocationMaps ? 220 : 240,
                    '14': hasLocationMaps ? 240 : 260,
                    '16': hasLocationMaps ? 260 : 280,
                    '18': hasLocationMaps ? 280 : 300
                };
                
                const minWidth = minWidthByFont[fontSize] || (hasLocationMaps ? 220 : 240);
                const maxWidth = containerRect.width * 0.5; // Máximo 50% da largura
                
                const clampedWidth = Math.max(minWidth, Math.min(newLegendWidth, maxWidth));
                
                // Calcula a porcentagem da largura da legenda
                const legendWidthPercent = (clampedWidth / containerRect.width) * 100;
                const mapWidthPercent = 100 - legendWidthPercent;
                
                // Aplica ao grid
                container.style.gridTemplateColumns = `${mapWidthPercent}% minmax(${minWidth}px, ${legendWidthPercent}%)`;
            });

            // Handler global para soltar o mouse
            const mouseUpHandler = function() {
                if (isResizingLegendRight) {
                    isResizingLegendRight = false;
                    legend.classList.remove('resizing');
                    
                    // Atualiza o mapa para se ajustar ao novo tamanho
                    setTimeout(() => {
                        if (mapPreview) mapPreview.invalidateSize();
                    }, 100);
                }
            };
            
            // Adiciona listeners globais
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            // Armazena handlers para possível remoção posterior
            legend._rightResizeHandlers = {
                mouseMove: mouseMoveHandler,
                mouseUp: mouseUpHandler
            };
        }
        
        /**
         * Remove o resize da legenda quando ela não está mais à direita.
         */
        function removeLegendRightResize() {
            const legend = document.getElementById('legendContainer');
            
            if (legend && legend._rightResizeHandlers) {
                document.removeEventListener('mousemove', legend._rightResizeHandlers.mouseMove);
                document.removeEventListener('mouseup', legend._rightResizeHandlers.mouseUp);
                delete legend._rightResizeHandlers;
            }
            
            if (legend) {
                const resizeHandleLeft = legend.querySelector('.legend-resize-handle-left');
                if (resizeHandleLeft) {
                    resizeHandleLeft.remove();
                }
                legend.classList.remove('resizing');
            }
            
            legendRightResizeInitialized = false;
            isResizingLegendRight = false;
            legendRightResizeContainer = null;
        }


        /**
         * Renderiza o MAPA DE PREVIEW (mapPreview).
         * ATUALIZADO: Remove a camada de fundo do ESTADO, mantendo apenas o MUNICÍPIO.
         */
       /**
 * Renderiza o MAPA DE PREVIEW (mapPreview).
 * ATUALIZADO: Remove a camada de fundo do ESTADO, mantendo apenas o MUNICÍPIO.
 * ATUALIZADO: Carrega dados do banco para o preview
 */
async function updateMapPreview() {
    // Inicializa o mapa apenas uma vez e reutiliza nas atualizações
    const previewElement = document.getElementById('mapPreviewLeaflet');
    if (!mapPreview) {
        previewElement.innerHTML = '';
        mapPreview = L.map('mapPreviewLeaflet', {
            preferCanvas: true,
            zoomControl: false,
        }).setView([-32.0353, -52.0987], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            
        }).addTo(mapPreview);



        // Inicializa grupo de camadas do preview
        previewOverlayGroup = L.layerGroup().addTo(mapPreview);
    } 

    // Adiciona controles ao preview (Norte, Escala, Grade) só uma vez
    addPreviewControls();

    // Limpa camadas do preview, mantendo base e controles
    if (previewOverlayGroup) {
        previewOverlayGroup.clearLayers();
    }

    // *** CARREGA DADOS DO BANCO PARA O PREVIEW ***
    try {
        await loadMapDataForPreview();
    } catch (error) {
        console.error('Erro ao carregar dados do banco para preview:', error);
    }

    // *** RENDERIZA OS DADOS DO USUÁRIO NO PREVIEW ***
    renderPreviewData();

    // *** RE-ADICIONA A MALHA MUNICIPAL SE ESTIVER ATIVA ***
    const addMunicipalMesh = document.getElementById('addMunicipalMesh');
    if (addMunicipalMesh && addMunicipalMesh.checked) {
        await addMunicipalMeshToPreview();
    }
    
    // *** ATUALIZA O LAYOUT COMPLETO DO PREVIEW ***
    updatePreviewLayout();
    
    // Ajusta a visualização (bounds)
    setTimeout(() => {
        mapPreview.invalidateSize();
        
        // Calcula bounds apenas dos itens do usuário
        const visibleItems = markersData.filter(item => {
            if (!item.coordinates) return false;
            const itemName = item.nome || item.tipo || 'Sem nome';
            const itemGeometry = item.geometry || '';
            const layerKey = `${itemName}-${itemGeometry}`;
            const checkbox = document.getElementById(`layer-${layerKey}`);
            return !checkbox || checkbox.checked;
        });
        
        if (visibleItems.length > 0) {
            const bounds = new L.LatLngBounds();
            visibleItems.forEach(item => {
                if (item.coordinates) {
                    bounds.extend(item.coordinates);
                }
            });
            
            if (bounds.isValid()) {
                mapPreview.fitBounds(bounds, { padding: [20, 20] });
            }
        }
        
        if (mapLoc2 && !document.getElementById('locationMap2').classList.contains('hidden')) {
            setTimeout(() => {
                renderLocationMap2();
            }, 200);
        }
    }, 100);
}

function updatePreviewLayout() {
    const position = document.querySelector('input[name="legendPosition"]:checked').value;
    const columns = document.getElementById('legendColumns').value;
    const fontSize = document.getElementById('legendFontSize').value;
    const spacing = document.getElementById('legendSpacing').value;
    const container = document.getElementById('previewContainer');
    const legendItemsEl = document.getElementById('legendItems');
    const legendContainerEl = document.getElementById('legendContainer');
    const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked')?.value || 0);

    // Reseta classes
    container.className = 'preview-container';
    legendItemsEl.className = '';
    container.classList.remove('legend-narrow', 'legend-wide', 'legend-small', 'legend-above', 'legend-below', 'layout-inside', 'layout-right', 'layout-bottom', 'layout-with-location');
    legendContainerEl.classList.remove('legend-spacing-very-compact', 'legend-spacing-compact', 'legend-spacing-normal', 'legend-spacing-loose', 'legend-spacing-very-loose');

    // Mostra/oculta controle de posição (acima/abaixo)
    const legendRightPositionGroup = document.getElementById('legendRightPositionGroup');
    const legendRightPositionGroup2 = document.getElementById('legendRightPositionGroup2');
    const legendWidthInfo = document.getElementById('legendWidthInfo');
    if (position === 'right' && numMaps > 0) {
        legendRightPositionGroup.style.display = 'block';
        legendRightPositionGroup2.style.display = 'block';
        if (legendWidthInfo) legendWidthInfo.style.display = 'block';
    } else if (position === 'right') {
        legendRightPositionGroup.style.display = 'none';
        legendRightPositionGroup2.style.display = 'none';
        if (legendWidthInfo) legendWidthInfo.style.display = 'block';
    } else {
        legendRightPositionGroup.style.display = 'none';
        legendRightPositionGroup2.style.display = 'none';
        if (legendWidthInfo) legendWidthInfo.style.display = 'none';
    }

    // Aplica classes de layout
    if (numMaps > 0) {
        container.classList.add('layout-with-location');
        container.classList.add(`layout-${position}`);
        
        if (position === 'right') {
            const itemCount = legendItemsEl.querySelectorAll('.legend-item').length;
            if (itemCount >= 2 && itemCount <= 4) {
                container.classList.add('legend-small');
            }
            
            const rightPosition = document.querySelector('input[name="legendRightPosition"]:checked')?.value || 'above';
            container.classList.remove('legend-above', 'legend-below');
            container.classList.add(`legend-${rightPosition}`);
        }
    } else {
        container.classList.add(`layout-${position}`);
    }

    // Aplica colunas
    legendItemsEl.classList.add(columns > 1 ? `legend-columns-${columns}` : 'legend-columns-1');

    // Aplica tamanho de fonte e espaçamento
    legendContainerEl.className = `legend-preview font-size-${fontSize} legend-spacing-${spacing}`;

    // Ajusta altura máxima da legenda baseado no tamanho do mapa (quando à direita)
    if (position === 'right') {
        const mapEl = numMaps > 0 
            ? document.querySelector('.layout-with-location.layout-right .map-preview')
            : document.querySelector('.layout-right .map-preview');
        if (mapEl) {
            legendContainerEl.style.maxHeight = mapEl.offsetHeight + 'px';
        }
        // Configura resize da legenda quando está à direita
        setTimeout(() => {
            setupLegendRightResize();
        }, 100);
    } else {
        legendContainerEl.style.maxHeight = '';
        // Remove estilo de grid quando não está à direita
        container.style.gridTemplateColumns = '';
        // Remove resize da legenda quando não está à direita
        removeLegendRightResize();
    }

    // Configura drag/resize da legenda (se 'inside')
    if (position === 'inside') {
        setTimeout(() => {
            setupLegendDragAndResize();
        }, 100);
    } else {
        removeLegendDragAndResize();
    }
}
/**
 * Carrega os dados do banco especificamente para o preview
 */
async function loadMapDataForPreview() {
    try {
        const response = await fetch('./dataservice/get_points.php');
        const data = await response.json();
        console.log('Dados carregados para preview:', data);
        
        // Processa os dados para o preview
        processGeoJSONForPreview(data);
    } catch (error) {
        console.error('Erro ao carregar dados para preview:', error);
        throw error;
    }
}

/**
 * Processa o GeoJSON recebido para o preview
 */

function processGeoJSONForPreview(data) {
    // Limpa dados anteriores do preview
    markersData = [];
    legendItems = []; // LIMPA OS ITENS DA LEGENDA TAMBÉM
    
    console.log('Processando GeoJSON para preview com', data.features?.length, 'features');

    // Processa os elementos do usuário
    data.features.forEach((feature, index) => {
        if (!feature.geometry) {
            console.warn('Feature sem geometria:', feature);
            return;
        }

        const geometryType = feature.geometry.type;
        const properties = feature.properties || {};
        const nome = properties.Nome || properties.Name || `Item ${index + 1}`;
        const tipo = properties.Tipo || properties.Type || 'Outros';
        
        // Extrai coordenadas corretamente
        let coordinates = [];
        if (geometryType === 'Point') {
            coordinates = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
        } else if (geometryType === 'LineString') {
            coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        } else if (geometryType === 'Polygon') {
            coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
        } else if (geometryType === 'Circle') {
            coordinates = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
        }

        // ADICIONA ÀS DUAS LISTAS: markersData E legendItems
        const legendItem = {
            tipo: tipo,
            nome: nome,
            geometry: geometryType,
            properties: properties,
            coordinates: coordinates,
            icon_url: properties.icon?.options?.iconUrl || null,
            color: properties.color || getDefaultColor(tipo),
            size: properties.size || 'medium'
        };

        if (geometryType === 'Circle') {
            legendItem.radius = feature.geometry.coordinates[2];
        }

        markersData.push(legendItem);
        legendItems.push(legendItem); // ADICIONA TAMBÉM À LEGENDA
    });

    console.log('Total de itens carregados para preview:', markersData.length);
    console.log('Total de itens na legenda:', legendItems.length);
    
    // Atualiza controle de camadas no modal
    updateLayersControl();
    
    // Atualiza itens da legenda
    loadLegendItems();
}

/**
 * Renderiza os dados no mapa de preview
 */
function renderPreviewData() {
    // 1. Verificação inicial
    if (!mapPreview || !previewOverlayGroup) return;

    // Remove todas as camadas existentes do grupo de preview para evitar duplicação
    previewOverlayGroup.clearLayers();

    // Adiciona os elementos do usuário (pontos, linhas, etc.)
    markersData.forEach(item => {
        try {
            // 2. Verificação de coordenadas
            if (!item.coordinates) return;

            // 3. Define as propriedades e verifica a visibilidade da camada
            // Adiciona uma forma de acessar properties mais fácil, se existir
            const properties = item.properties || {}; // Assume um objeto vazio se não houver properties
            
            // NOTE: A variável 'feature' no seu código original estava indefinida ou vindo de outro escopo. 
            // O código abaixo assume que as propriedades para visibilidade vêm do próprio 'item'.
            // Vamos manter a lógica original de visibilidade, ajustando o acesso a 'properties'
            
            // O nome da camada deve usar o nome ou tipo, preferencialmente do item
            const itemName = item.nome || item.tipo || properties.Nome || properties.Name || 'Sem nome';
            const itemGeometry = item.geometry || '';
            const layerKey = `${itemName}-${itemGeometry}`;
            const checkbox = document.getElementById(`layer-${layerKey}`);
            const isVisible = !checkbox || checkbox.checked;

            if (!isVisible) return; // Pula se a camada estiver marcada como invisível

            let layer;
            // Cria um objeto latLng. Note: No Leaflet, o padrão é [lat, lng].
            const latlng = L.latLng(item.coordinates[0], item.coordinates[1]); 

            // 4. Criação da camada Leaflet
            switch (item.geometry) {
                case 'Point':
                    if (item.icon_url || properties.icon_url) { // Verifica icon_url no item OU em properties
                        const iconUrl = item.icon_url || properties.icon_url;
                        const iconSize = properties.iconSize || [16, 16]; // Pode vir de properties
                        const iconAnchor = properties.iconAnchor || [iconSize[0]/2, iconSize[1]];

                        const icon = L.icon({
                            iconUrl: iconUrl,
                            iconSize: iconSize,
                            iconAnchor: iconAnchor
                        });
                        layer = L.marker(latlng, { icon: icon });
                    } else {
                        // Marcador de círculo padrão
                        layer = L.circleMarker(latlng, {
                            radius: properties.radius || 5, // Prefere properties
                            fillColor: properties.fillColor || item.color || '#3498db', // Prefere properties
                            color: properties.color || '#000',
                            weight: properties.weight || 1,
                            opacity: properties.opacity || 1,
                            fillOpacity: properties.fillOpacity || 0.8
                        });
                    }
                    break;

                case 'LineString':
                    if (item.coordinates && item.coordinates.length > 1) {
                        // Nota: O formato GeoJSON é [lng, lat], mas seu código usa [lat, lng] no preview.
                        // Mantemos o seu formato [lat, lng] aqui.
                        const latLngs = item.coordinates.map(coord => L.latLng(coord[0], coord[1]));
                        layer = L.polyline(latLngs, {
                            // Usando propriedades, dando prioridade a 'properties'
                            color: properties.color || item.color || '#2ecc71', 
                            weight: properties.weight || 2,
                            opacity: properties.opacity,
                            dashArray: properties.dashArray
                        });
                    }
                    break;

                case 'Polygon':
                    if (item.coordinates && item.coordinates.length > 2) {
                        // Nota: O formato GeoJSON é [lng, lat] para as coordenadas do anel externo,
                        // mas seu código usa [lat, lng] para os pontos do preview.
                        // Mantemos o seu formato [lat, lng] aqui.
                        const latLngs = item.coordinates.map(coord => L.latLng(coord[0], coord[1]));
                        layer = L.polygon(latLngs, {
                            // Usando propriedades, dando prioridade a 'properties'
                            fillColor: properties.fillColor || item.fillColor || '#27ae60',
                            color: properties.color || item.color || '#1e5631',
                            fillOpacity: properties.fillOpacity || 0.7, // Adicionei um default fillOpacity
                            weight: properties.weight || 2,
                            opacity: properties.opacity,
                            dashArray: properties.dashArray
                        });
                    }
                    break;

                case 'Circle':
                    layer = L.circle(latlng, {
                        // Usando propriedades, dando prioridade a 'properties'
                        radius: properties.radius || item.radius || 50,
                        fillColor: properties.fillColor || item.color || '#3498db',
                        color: properties.color || '#000',
                        fillOpacity: properties.fillOpacity || 0.7,
                        weight: properties.weight || 1,
                        opacity: properties.opacity,
                        dashArray: properties.dashArray
                    });
                    break;
            }
            
            // 5. Vincula tooltip com o nome do item (rótulo permanente)
            if (layer) {
                const labelText = (item.nome && item.nome.trim() !== '' && item.nome !== 'Sem nome' && item.nome !== 'undefined')
                    ? item.nome
                    : null;

                if (labelText) {
                    layer.bindTooltip(labelText, {
                        permanent: true,
                        direction: 'right',
                        className: 'map-label',
                        offset: [10, 0]
                    });
                }
            }

            // 6. Adiciona a camada ao grupo de preview
            if (layer && previewOverlayGroup) {
                previewOverlayGroup.addLayer(layer);
            }
        } catch (error) {
            console.warn('Erro ao adicionar elemento ao preview:', error, item);
        }
    });

    // É útil adicionar esta linha para garantir que o grupo de preview esteja no mapa
    if (previewOverlayGroup && !mapPreview.hasLayer(previewOverlayGroup)) {
        mapPreview.addLayer(previewOverlayGroup);
    }
}


        /**
         * Adiciona controles (Norte, Escala, Grade) ao MAPA DE PREVIEW.
         */
        function addPreviewControls() {
            // Evita duplicar controles
            if (previewControlsInitialized || !mapPreview) return;
            previewControlsInitialized = true;

            // Escala gráfica no preview
            L.control.graphicScale({
                doubleLine: true,
                fill: 'fill',
                showSubunits: false,
                lengthUnit: 'metric',
                position: 'bottomleft'
            }).addTo(mapPreview);

            // GRADE NO PREVIEW
            new AutoGraticule({
                redraw: 'move',
                lineInterpolation: 'linear',
                font: '8px Georgia, serif',
                fontColor: '#333',
                fontSize: '8px',
                opacity: 0.6,
                dashArray: [2, 2],
                weight: 0.6
            }).addTo(mapPreview);

            // Norte no preview
            const nortePreview = L.control({position: 'bottomleft'});
            nortePreview.onAdd = function () {
                var div = L.DomUtil.create("div", "img");
                div.innerHTML = '<img src="./img/norte.png" style="width: 70px; height: 70px; opacity: 0.9; margin-left: 100%;" alt="Norte">';
                return div;
            };
            nortePreview.addTo(mapPreview);
        }

        // =========================================================================
        // LÓGICA DE EXPORTAÇÃO (PNG/PDF)
        // =========================================================================

       /**
        * Função principal de exportação.
        * 1. Captura o mapa Leaflet (mapPreview) como uma imagem estática (mapImage).
        * 2. Substitui o mapa Leaflet por esta imagem no DOM.
        * 3. Captura o container inteiro (previewContainer) usando html2canvas.
        * 4. Restaura o mapa Leaflet original.
        * 5. Gera o download (PNG ou PDF).
        */
 async function exportMap() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const loading = document.getElementById('loadingExport');
    
    loading.classList.add('active');
    try {
        const container = document.getElementById('previewContainer');
        const originalMapPreview = document.getElementById('mapPreviewLeaflet');
        const originalMapContent = originalMapPreview.innerHTML;
        
        // Substitui o mapa por imagem
        const mapImage = await captureMapAsImage();
        originalMapPreview.innerHTML = '';
        originalMapPreview.style.backgroundImage = `url(${mapImage})`;
        originalMapPreview.style.backgroundSize = 'cover';
        originalMapPreview.style.backgroundPosition = 'center';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ❌ REMOVER ESTAS LINHAS:
        // const originalContainerStyle = container.style.cssText;
        // container.style.padding = '15px';
        // container.style.margin = '10px';
        // container.style.boxSizing = 'border-box';
        
        // Captura SEM alterar padding/margin
        const canvas = await html2canvas(container, {
            scale: parseInt(document.getElementById('dpi').value) / 96,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            removeContainer: true
        });
        
        // ✅ ADICIONAR MARGEM NO CANVAS
        const marginPx = 30; // Margem em pixels (ajuste conforme necessário)
        const canvasWithMargin = document.createElement('canvas');
        const ctx = canvasWithMargin.getContext('2d');
        
        canvasWithMargin.width = canvas.width + (marginPx * 2);
        canvasWithMargin.height = canvas.height + (marginPx * 2);
        
        // Preenche com branco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWithMargin.width, canvasWithMargin.height);
        
        // Desenha o canvas original centralizado
        ctx.drawImage(canvas, marginPx, marginPx);
        
        // Restaura o mapa
        originalMapPreview.style.backgroundImage = '';
        originalMapPreview.innerHTML = originalMapContent;
        
        if (mapPreview) {
            mapPreview.invalidateSize();
        }


        const titleInput = document.getElementById('mapTitleInput').value
        const fileName = titleInput
        
        // Exporta usando o canvas com margem
        if (format === 'png') {
            const link = document.createElement('a');
            link.download = `${titleInput}.png`;
            link.href = canvasWithMargin.toDataURL('image/png');
            link.click();
        } else {
            const { jsPDF } = window.jspdf;
            const paperSize = document.getElementById('paperSize').value;
            const orientation = document.getElementById('orientation').value;
            
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: paperSize.toLowerCase()
            });
            
            const imgData = canvasWithMargin.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps = pdf.getImageProperties(imgData);
            const marginMM = 10;
            const imgWidth = pdfWidth - (2 * marginMM);
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            
            const x = marginMM;
            const y = (pdfHeight - imgHeight) / 2;
            
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`${titleInput}.pdf`);
        }
        
        alert('✅ Mapa exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        alert('❌ Erro ao exportar o mapa. Tente novamente.');
    } finally {
        loading.classList.remove('active');
    }
}

        /**
         * Captura apenas o contêiner do 'mapPreview' (incluindo a grade) como uma imagem DataURL.
         */
        async function captureMapAsImage() {
            return new Promise((resolve, reject) => {
                if (!mapPreview) {
                    reject('Mapa preview não inicializado');
                    return;
                }

                // Força a redraw da grade
                if (window.AutoGraticule && mapPreview._graticule) {
                    mapPreview._graticule.redraw();
                }

                // Aguarda a grade renderizar
                setTimeout(() => {
                    html2canvas(mapPreview.getContainer(), {
                        scale: 2, // Maior qualidade
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#e8f4f8',
                        logging: false,
                        onclone: function(clonedDoc) {
                            // Apenas no clone (não afeta o preview original)
                            // Garante que os rótulos de latitude/longitude sejam capturados
                            const clonedMap = clonedDoc.querySelector('#mapPreviewLeaflet');
                            if (clonedMap) {
                                // Aplica overflow visible apenas no clone para captura
                                clonedMap.style.overflow = 'visible';
                                
                                // Garante que os rótulos da grade sejam visíveis
                                const gridLabels = clonedDoc.querySelectorAll('.leaflet-grid-label');
                                gridLabels.forEach(label => {
                                    label.style.visibility = 'visible';
                                    label.style.opacity = '1';
                                    label.style.display = 'block';
                                    label.style.zIndex = '1001';
                                });
                            }
                        }
                    }).then(canvas => {
                        resolve(canvas.toDataURL('image/png'));
                    }).catch(error => {
                        console.warn('Erro na captura do mapa:', error);
                        resolve(createSimpleMapImage()); // Fallback
                    });
                }, 1500); // Tempo extra para grade
            });
        }

        // Fecha modal ao clicar fora
        window.onclick = function(event) {
            const modal = document.getElementById('exportModal');
            if (event.target === modal) {
                closeExportModal();
            }
        }

        // =========================================================================
        // CONTROLE DE CAMADAS (Checkboxes)
        // =========================================================================

        /**
         * Atualiza a lista de checkboxes de "Controle de Camadas" no modal.
         */
        function updateLayersControl() {
            const container = document.getElementById('layersControl');
            container.innerHTML = '';

            if (legendItems.length === 0) {
                container.innerHTML = '<p style="font-size: 12px; color: #999; padding: 10px;">Nenhuma camada disponível</p>';
                return;
            }

            // Agrupa itens por nome e geometria
            const layerGroups = {};
            legendItems.forEach(item => {
                const displayName = item.nome || item.tipo || 'Sem nome';
                const key = `${displayName}-${item.geometry}`;
                
                if (!layerGroups[key]) {
                    layerGroups[key] = {
                        name: displayName,
                        tipo: item.tipo,
                        geometry: item.geometry,
                        items: []
                    };
                }
                layerGroups[key].items.push(item);
            });

            // Cria checkboxes
            Object.keys(layerGroups).forEach(key => {
                const group = layerGroups[key];
                const div = document.createElement('div');
                div.className = 'layer-control-item';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `layer-${key}`;
                checkbox.checked = true;
                checkbox.addEventListener('change', function() {
                    toggleLayerByName(key, this.checked);
                });

                const label = document.createElement('label');
                label.htmlFor = `layer-${key}`;
                label.innerHTML = `<span class="layer-name">${group.name}</span> <span class="layer-type">(${group.geometry})</span>`;

                div.appendChild(checkbox);
                div.appendChild(label);
                container.appendChild(div);
            });
        }

        /**
         * Mostra/Oculta camadas no mapa principal, legenda e preview ao (des)marcar um checkbox.
         */
        function toggleLayerByName(layerKey, visible) {
            const [name, geometry] = layerKey.split('-');
            
            // 1. Atualiza no MAPA PRINCIPAL
            Object.keys(overLayers).forEach(layerName => {
                if (layerName === name || layerName.includes(name)) {
                    if (visible) {
                        if (!map.hasLayer(overLayers[layerName])) {
                            map.addLayer(overLayers[layerName]);
                        }
                    } else {
                        if (map.hasLayer(overLayers[layerName])) {
                            map.removeLayer(overLayers[layerName]);
                        }
                    }
                }
            });

            // 2. Atualiza na LEGENDA
            const legendItemsEl = document.getElementById('legendItems');
            const items = legendItemsEl.querySelectorAll('.legend-item');
            items.forEach(item => {
                const itemName = item.querySelector('.legend-label')?.textContent || '';
                const itemGeometry = item.dataset.geometry || '';
                
                if (itemName === name && itemGeometry === geometry) {
                    item.style.display = visible ? 'flex' : 'none';
                }
            });

            // 3. Atualiza no MAPA DE PREVIEW (recriando os itens)
            if (mapPreview) {
                // Remove todos os layers (exceto base, estado, município)
                mapPreview.eachLayer(layer => {
                    if (layer instanceof L.Marker || layer instanceof L.Circle || 
                        layer instanceof L.Polyline || layer instanceof L.Polygon) {
                        // Não remove camadas de fundo
                        if (!layer.options.style || (layer.options.style.fillOpacity !== 0.2 && layer.options.style.fillOpacity !== 0.3)) {
                             mapPreview.removeLayer(layer);
                        }
                    }
                });

                // Adiciona apenas os itens visíveis
                markersData.forEach(item => {
                    const itemName = item.nome || item.tipo || 'Sem nome';
                    const itemGeometry = item.geometry || '';
                    const layerKey = `${itemName}-${itemGeometry}`;
                    
                    const checkbox = document.getElementById(`layer-${layerKey}`);
                    const isVisible = !checkbox || checkbox.checked;
                    
                    if (isVisible) {
                        addItemToPreview(item); // Adiciona o item (ponto/linha/polígono)
                    }
                });
            }

            setTimeout(() => {
                if (mapPreview) mapPreview.invalidateSize();
            }, 100);
        }

        /**
         * Função auxiliar para adicionar um único item (ponto, linha, etc.) ao preview.
         */
        function addItemToPreview(item) {
             if (!item.coordinates || !mapPreview) return;

    try {
        // Limita o número de features visíveis de uma vez
        const totalLayers = Object.keys(mapPreview._layers).length;
        if (totalLayers > 1000) {
            console.warn('Muitas camadas no preview. Limpando...');
            // Remove camadas mais antigas
            const layerArray = Object.values(mapPreview._layers);
            for (let i = 0; i < 100 && i < layerArray.length; i++) {
                if (layerArray[i].remove && 
                    !(layerArray[i] instanceof L.TileLayer) &&
                    !(layerArray[i] instanceof L.Control)) {
                    mapPreview.removeLayer(layerArray[i]);
                }
            }
        }

        let layer;
        const latlng = L.latLng(item.coordinates[0], item.coordinates[1]);

        switch (item.geometry) {
            case 'Point':
                if (item.icon_url) {
                    const icon = L.icon({
                        iconUrl: item.icon_url,
                        iconSize: [16, 16],
                        iconAnchor: [8, 16]
                    });
                    layer = L.marker(latlng, { icon: icon }).addTo(mapPreview);
                } else {
                    layer = L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: item.color || '#3498db',
                        color: '#000',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(mapPreview);
                }
                break;

            case 'LineString':
                if (item.coordinates && item.coordinates.length > 1) {
                    const latLngs = item.coordinates.map(coord => L.latLng(coord[0], coord[1]));
                    layer = L.polyline(latLngs, {
                        color: item.properties?.color || item.color || '#2ecc71',
                        weight: item.properties?.weight || 2,
                        dashArray: item.properties?.dashArray
                    }).addTo(mapPreview);
                }
                break;

            case 'Polygon':
                if (item.coordinates && item.coordinates.length > 2) {
                    const latLngs = item.coordinates.map(coord => L.latLng(coord[0], coord[1]));
                    layer = L.polygon(latLngs, {
                        fillColor: item.properties?.fillColor || item.fillColor || '#27ae60',
                        color: item.properties?.color || item.color || '#1e5631',
                        fillOpacity: 0.7,
                        dashArray: item.properties?.dashArray,
                        weight: 2
                    }).addTo(mapPreview);
                }
                break;

            case 'Circle':
                layer = L.circle(latlng, {
                    radius: item.radius || 50,
                    fillColor: item.color || '#3498db',
                    color: '#000',
                    fillOpacity: 0.7,
                    weight: 1
                }).addTo(mapPreview);
                break;
        }
    } catch (error) {
        console.warn('Erro ao adicionar item ao preview:', error, item);
    }
        }


        // =========================================================================
        // MAPAS DE LOCALIZAÇÃO (Pequenos)
        // =========================================================================

        /**
         * Atualiza a visibilidade e o layout dos mapas de localização (0, 1 ou 2).
         */
        
function updateLocationMaps() {
    const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked').value);
    const container = document.getElementById('previewContainer');
    const locationContainer = document.getElementById('locationMapsContainer');
    const map1 = document.getElementById('locationMap1');
    const map2 = document.getElementById('locationMap2');
    const locationSelectGroup = document.getElementById('locationSelectGroup');
    const colorsSelectGroup = document.getElementById('colorsSelectGroup');
    const municipalMeshGroup = document.getElementById('municipalMeshGroup');
    
    // Controles específicos de cada mapa
    const map1Controls = document.getElementById('map1Controls');
    const map2Controls = document.getElementById('map2Controls');
    const municipioWrapperMap1 = document.getElementById('municipalitySelectWrapperMap1');
    const municipioWrapper = document.getElementById('municipalitySelectWrapper');
    const municipioColorWrapper = document.getElementById('municipioColorWrapper');

    const legendPosition = document.querySelector('input[name="legendPosition"]:checked')?.value || 'inside';
    
    if (numMaps === 0) {
        // Nenhum mapa de localização
        map1.classList.add('hidden');
        map2.classList.add('hidden');
        locationContainer.classList.add('hidden');
        locationSelectGroup.style.display = 'none';
        colorsSelectGroup.style.display = 'none';
        municipalMeshGroup.style.display = 'none';
        map1Controls.style.display = 'none';
        map2Controls.style.display = 'none';
        container.classList.remove('layout-with-location', 'legend-small');
        container.classList.add(`layout-${legendPosition}`);
    } else if (numMaps === 1) {
        // 1 Mapa: mostra controles do Mapa 1
        map1.classList.remove('hidden');
        map2.classList.add('hidden');
        locationContainer.classList.remove('hidden');
        locationSelectGroup.style.display = 'block';
        colorsSelectGroup.style.display = 'block';
        municipalMeshGroup.style.display = 'block';
        
        map1Controls.style.display = 'block';
        map2Controls.style.display = 'none';
        municipioWrapperMap1.style.display = 'block';
        municipioColorWrapper.style.display = 'block';
        
        container.classList.add('layout-with-location');
        container.classList.add(`layout-${legendPosition}`);
        
        initLocationMap1();
    } else if (numMaps === 2) {
        // 2 Mapas: mostra controles do Mapa 2
        map1.classList.remove('hidden');
        map2.classList.remove('hidden');
        locationContainer.classList.remove('hidden');
        locationSelectGroup.style.display = 'block';
        colorsSelectGroup.style.display = 'block';
        municipalMeshGroup.style.display = 'block';
        
        map1Controls.style.display = 'none';
        map2Controls.style.display = 'block';
        
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect.value) {
            municipioWrapper.style.display = 'block';
            municipioColorWrapper.style.display = 'block';
            loadMunicipalities(stateSelect.value);
        } else {
            municipioWrapper.style.display = 'none';
            municipioColorWrapper.style.display = 'none';
        }
        
        container.classList.add('layout-with-location');
        container.classList.add(`layout-${legendPosition}`);
        
        initLocationMap1();
        initLocationMap2();
    }


    
    setTimeout(() => {
        if (mapPreview) mapPreview.invalidateSize();
        if (mapLoc1) mapLoc1.invalidateSize();
        if (mapLoc2) mapLoc2.invalidateSize();
    }, 200);
}

        function updateLocationMap1() {
            if (!mapLoc1) {
                initLocationMap1();
            } else {
                renderLocationMap1();
            }
        }

        /**
         * Inicializa o Mapa de Localização 1 (Brasil)
         */
        function initLocationMap1() {
            const element = document.getElementById('mapLoc1Leaflet');
            if (mapLoc1) mapLoc1.remove();

            element.innerHTML = '';
            mapLoc1 = L.map('mapLoc1Leaflet', {
                zoomControl: false,
                preferCanvas: true
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {}).addTo(mapLoc1);

            renderLocationMap1();
            addPreviewControlsLoc1();
        }

        function addPreviewControlsLoc1(){
            L.control.graphicScale({
                position: 'bottomleft',
                minUnitWidth: 16,
                maxUnitsWidth: 80,
                doubleLine: false,
                fill: 'fill',
                showSubunits: false
            }).addTo(mapLoc1);

            // GRADE NO PREVIEW
            new AutoGraticule({
                redraw: 'move',
                lineInterpolation: 'linear',
                font: '3px Georgia, serif',
                fontColor: '#333',
                opacity: 0.6,
                dashArray: [2, 2],
                weight: 0.6
            }).addTo(mapLoc1);
        }




        /**
         * Renderiza o conteúdo (GeoJSON) do Mapa de Localização 1.
         */
function renderLocationMap1() {
    if (!mapLoc1) return;

    // Limpa TODAS as camadas anteriores (exceto base)
    mapLoc1.eachLayer(layer => {
        if (layer instanceof L.TileLayer || layer instanceof L.Control) {
            return; // Mantém base e controles
        }
        mapLoc1.removeLayer(layer);
    });

    const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked')?.value || 0);
    
    // Determina qual select usar
    let stateSelect, municipioSelect;
    if (numMaps === 1) {
        stateSelect = document.getElementById('stateSelectMap1');
        municipioSelect = document.getElementById('municipalitySelectMap1');
    } else if (numMaps === 2) {
        stateSelect = document.getElementById('stateSelect');
        municipioSelect = document.getElementById('municipalitySelect');
    } else {
        // Fallback para quando não há mapas de localização
        mapLoc1.fitBounds([[-33.7, -57.6], [-27.1, -49.7]]);
        setTimeout(() => { mapLoc1.invalidateSize(); }, 100);
        return;
    }
    
    const estadoColorInput = document.getElementById('estadoColor');
    const municipioColorInput = document.getElementById('municipioColor');
    const cd_uf = stateSelect?.value;
    const cd_mun = municipioSelect?.value;
    
    const estadoColor = estadoColorInput?.value || '#F7C986';
    const municipioColor = municipioColorInput?.value || '#E6A4A4';

    // Se não tem estado selecionado, sai
    if (!cd_uf || !estadosGeoJSON) {
        mapLoc1.fitBounds([[-33.7, -57.6], [-27.1, -49.7]]);
        setTimeout(() => { mapLoc1.invalidateSize(); }, 100);
        return;
    }

    // Encontra o estado no GeoJSON
    const estadoFeature = estadosGeoJSON.features.find(f => f.properties.CD_UF === cd_uf);
    if (!estadoFeature) {
        mapLoc1.fitBounds([[-33.7, -57.6], [-27.1, -49.7]]);
        setTimeout(() => { mapLoc1.invalidateSize(); }, 100);
        return;
    }

    // Adiciona o ESTADO (fundo)
    const estadoLayer = L.geoJSON(estadoFeature, {
        style: {
            color: estadoColor,
            fillColor: estadoColor,
            opacity: 1,
            fillOpacity: 1,
            weight: 3
        }
    }).addTo(mapLoc1);

    let allBounds = estadoLayer.getBounds();

    // Se tem município selecionado, carrega também
    if (cd_mun && cd_uf) {
        const estado = estadosList.find(e => e.cd_uf === cd_uf);
        if (estado) {
            const sigla = estado.sigla_uf.toLowerCase();
            
            // Usa async/await para carregar o município
            (async () => {
                try {
                    const municipiosData = await fetchMunicipiosGeoJSON(cd_uf);
                    const municipioFeature = municipiosData.features.find(f => f.properties.CD_MUN === cd_mun);
                    
                    if (municipioFeature) {
                        const municipioLayer = L.geoJSON(municipioFeature, {
                            style: {
                                color: municipioColor,
                                fillColor: municipioColor,
                                fillOpacity: 1,
                                opacity: 1,
                                weight: 3
                            }
                        }).addTo(mapLoc1);
                        
                        // Estende bounds para incluir município
                        const municipioBounds = municipioLayer.getBounds();
                        allBounds = allBounds.extend(municipioBounds);
                        
                        // Aplica o zoom baseado no número de mapas
                        if (numMaps === 1) {
                            // 1 mapa: zoom no município
                            mapLoc1.fitBounds(municipioBounds, { padding: [30, 30] });
                        } else {
                            // 2 mapas: zoom no estado (incluindo o município)
                            mapLoc1.fitBounds(allBounds, { padding: [30, 30] });
                        }
                    } else {
                        // Município não encontrado, mantém zoom no estado
                        mapLoc1.fitBounds(allBounds, { padding: [30, 30] });
                    }
                } catch (error) {
                    console.error('Erro ao carregar município:', error);
                    // Em caso de erro, mantém zoom no estado
                    mapLoc1.fitBounds(allBounds, { padding: [30, 30] });
                }
            })();
        }
    } else {
        // Sem município, apenas zoom no estado
        mapLoc1.fitBounds(allBounds, { padding: [30, 30] });
    }

    // Atualiza tamanho do mapa
    setTimeout(() => { mapLoc1.invalidateSize(); }, 100);
}


       function updateLocationMap2() {
            if (!mapLoc2) {
                initLocationMap2();
            } else {
                renderLocationMap2();
            }
          
        }

        /**
         * Inicializa o Mapa de Localização 2 (Estado/Município)
         */
        function initLocationMap2() {
            const element = document.getElementById('mapLoc2Leaflet');
            if (mapLoc2) mapLoc2.remove();

            element.innerHTML = '';
            mapLoc2 = L.map('mapLoc2Leaflet', {
                zoomControl: false,
                preferCanvas: true
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {}).addTo(mapLoc2);

            renderLocationMap2();
            addPreviewControlsLoc2()
        }

          function addPreviewControlsLoc2(){
            L.control.graphicScale({
                position: 'bottomleft',
                minUnitWidth: 16,
                maxUnitsWidth: 80,
                doubleLine: false,
                fill: 'fill',
                showSubunits: false
            }).addTo(mapLoc2);

            // GRADE NO PREVIEW
            new AutoGraticule({
                redraw: 'move',
                lineInterpolation: 'linear',
                font: '3px Georgia, serif',
                fontColor: '#333',
                opacity: 0.6,
                dashArray: [2, 2],
                weight: 0.6
            }).addTo(mapLoc2);
        }

        /**
         * Renderiza o conteúdo (GeoJSON) do Mapa de Localização 2.
         */
        
function renderLocationMap2() {
    // Verifica se o mapa foi inicializado
    if (!mapLoc2) return;

    // Remove camadas anteriores para garantir um mapa limpo
    if (locationPolygon2) {
        mapLoc2.removeLayer(locationPolygon2);
        locationPolygon2 = null;
    }

    const numMaps = parseInt(document.querySelector('input[name="locationMaps"]:checked')?.value || 0);
    const stateSelect = document.getElementById('stateSelect');
    const municipioSelect = document.getElementById('municipalitySelect');
    const estadoColorInput = document.getElementById('estadoColor');
    const municipioColorInput = document.getElementById('municipioColor');
    const cd_uf = stateSelect?.value;
    const cd_mun = municipioSelect?.value;
    
    // Cores (mantendo a lógica de fallback)
    const estadoColor = estadoColorInput ? estadoColorInput.value : '#ff8c00';
    const municipioColor = municipioColorInput ? municipioColorInput.value : '#ff8c00';

    // Apenas aplica a lógica de estado/município quando 2 mapas estão ativos
    if (numMaps !== 2) {
        // Lógica de fallback para outros casos (não 2 mapas)
        let fallbackBounds;
        if (mapPreview && mapPreview.getBounds().isValid()) {
            fallbackBounds = mapPreview.getBounds();
        }
        if (fallbackBounds && fallbackBounds.isValid()) {
            mapLoc2.fitBounds(fallbackBounds, { padding: [20, 20] });
        } else {
            // Define bounds default se nada for encontrado (ajuste conforme a sua área padrão)
            mapLoc2.fitBounds([[-33.7, -57.6], [-27.1, -49.7]]); 
        }
        setTimeout(() => { mapLoc2.invalidateSize(); }, 100);
        return;
    }

    // LÓGICA PRINCIPAL (numMaps === 2): Estado + Município, Zoom no Município
    if (cd_uf && cd_mun && estadosGeoJSON && municipiosGeoJSON) {
        const estadoFeature = estadosGeoJSON.features.find(f => f.properties.CD_UF === cd_uf);
        const municipioFeature = municipiosGeoJSON.features.find(f => f.properties.CD_MUN === cd_mun);

        if (estadoFeature && municipioFeature) {
            // Camada 1: Estado (Fundo Sutil)
            const estadoLayer = L.geoJSON(estadoFeature, {
                style: {
                    color: estadoColor,
                    fillColor: estadoColor,
                    opacity: 1,
                    fillOpacity: 1, // Opacidade baixa: aparece mas não esconde o município
                    weight: 3
                }
            }).addTo(mapLoc2);

            // Camada 2: Município (Destaque)
            const municipioLayer = L.geoJSON(municipioFeature, {
                style: {
                    color: municipioColor,
                    fillColor: municipioColor,
                    fillOpacity: 1, // Opacidade total: Destaque
                    opacity: 1,
                    weight: 3
                }
            }).addTo(mapLoc2);

            locationPolygon2 = L.layerGroup([estadoLayer, municipioLayer]);

            // ✅ CORREÇÃO: Zoom no Município
            mapLoc2.fitBounds(municipioLayer.getBounds(), { padding: [20, 20] });
        }
    } 
    // Invalida o tamanho do mapa após as operações
    setTimeout(() => { mapLoc2.invalidateSize(); }, 100);
}

        // =========================================================================
        // INTERATIVIDADE DA LEGENDA (DRAG/RESIZE)
        // =========================================================================

        // --- Variáveis de Drag/Resize da Legenda ---
        let legendDragResizeInitialized = false;
        let isDraggingLegend = false;
        let isResizingLegend = false;
        let legendStartX, legendStartY, legendStartLeft, legendStartTop, legendStartWidth, legendStartHeight;
        let currentLegendElement = null;
        let currentMapPreviewElement = null;

        // --- Handlers de Mousedown (para poderem ser removidos) ---
        let legendDragHandler = null;
        let legendResizeHandler = null;

        /**
         * Remove os listeners de mousedown para drag e resize da legenda.
         * Isso é chamado quando a legenda é movida para 'Lado Direito' ou 'Abaixo'.
         */
        function removeLegendDragAndResize() {
            if (!currentLegendElement) {
                // Se não há elemento, tenta pegar o elemento atual para garantir
                currentLegendElement = document.getElementById('legendContainer');
                if (!currentLegendElement) return;
            }

            // Remove o listener de drag do container
            if (legendDragHandler) {
                currentLegendElement.removeEventListener('mousedown', legendDragHandler);
                legendDragHandler = null;
            }
            
            // Remove o listener de resize do handle
            let resizeHandle = currentLegendElement.querySelector('.legend-resize-handle');
            if (resizeHandle && legendResizeHandler) {
                resizeHandle.removeEventListener('mousedown', legendResizeHandler);
                legendResizeHandler = null;
            }
            
            // Reseta estilos inline para que o CSS volte a controlar a posição
            currentLegendElement.classList.remove('dragging', 'resizing');
            currentLegendElement.style.position = '';
            currentLegendElement.style.left = '';
            currentLegendElement.style.top = '';
            currentLegendElement.style.width = '';
            currentLegendElement.style.height = '';
            currentLegendElement.style.right = '';
            currentLegendElement.style.bottom = '';

            legendDragResizeInitialized = false;
            // Não reseta currentLegendElement, pois podemos precisar dele
        }

        /**
         * Configura o drag-and-drop (mover) e o resize (redimensionar)
         * para a legenda QUANDO ela está na Posição "Dentro do Mapa".
         */
        function setupLegendDragAndResize() {
            const legend = document.getElementById('legendContainer');
            const mapPreview = document.getElementById('previewMap');
            if (!legend || !mapPreview) return;

            // Garante que a legenda está com posição absoluta
            if (window.getComputedStyle(legend).position !== 'absolute') {
                legend.style.position = 'absolute';
            }

            // Cria handle de resize se não existir
            let resizeHandle = legend.querySelector('.legend-resize-handle');
            if (!resizeHandle) {
                resizeHandle = document.createElement('div');
                resizeHandle.className = 'legend-resize-handle';
                legend.appendChild(resizeHandle);
            }

            // Verifica se já foi inicializado.
            // Se sim, não anexa os listeners 'mousedown' novamente.
            if (legendDragResizeInitialized && currentLegendElement === legend) {
                return; // Já está configurado para este elemento
            }
            
            legendDragResizeInitialized = true;
            currentLegendElement = legend;
            currentMapPreviewElement = mapPreview;

            // Função para garantir que a legenda fique dentro do mapa
            window.constrainLegend = function() {
                // ... (código interno de constrainLegend permanece o mesmo)
                const currentLegend = document.getElementById('legendContainer');
                const currentMap = document.getElementById('previewMap');
                if (!currentLegend || !currentMap) return;

                const mapContainer = currentMap.parentElement;
                const containerRect = mapContainer.getBoundingClientRect();

                let left = parseFloat(currentLegend.style.left) || 0;
                let top = parseFloat(currentLegend.style.top) || 0;
                let width = parseFloat(currentLegend.style.width) || currentLegend.offsetWidth;
                let height = parseFloat(currentLegend.style.height) || currentLegend.offsetHeight;

                // Limita posição e tamanho dentro do mapa
                const maxLeft = containerRect.width - width;
                const maxTop = containerRect.height - height;

                if (left < 0) left = 0;
                if (left > maxLeft) left = maxLeft;
                if (top < 0) top = 0;
                if (top > maxTop) top = maxTop;

                // Limita tamanho mínimo e máximo
                const minWidth = 200;
                const maxWidth = Math.min(400, containerRect.width - left);
                const minHeight = 100;
                const maxHeight = Math.min(containerRect.height * 0.6, containerRect.height - top);

                if (width < minWidth) width = minWidth;
                if (width > maxWidth) width = maxWidth;
                if (height < minHeight) height = minHeight;
                if (height > maxHeight) height = maxHeight;

                currentLegend.style.left = left + 'px';
                currentLegend.style.top = top + 'px';
                currentLegend.style.width = width + 'px';
                currentLegend.style.height = height + 'px';
            };

            // Edge detection for resize
            let hoverEdge = null; // 'n','s','e','w','ne','nw','se','sw'
            function getHoverEdge(e) {
                const rect = legend.getBoundingClientRect();
                const edgeSize = 6; // px
                const onLeft = Math.abs(e.clientX - rect.left) <= edgeSize;
                const onRight = Math.abs(e.clientX - rect.right) <= edgeSize;
                const onTop = Math.abs(e.clientY - rect.top) <= edgeSize;
                const onBottom = Math.abs(e.clientY - rect.bottom) <= edgeSize;
                if (onTop && onLeft) return 'nw';
                if (onTop && onRight) return 'ne';
                if (onBottom && onLeft) return 'sw';
                if (onBottom && onRight) return 'se';
                if (onTop) return 'n';
                if (onBottom) return 's';
                if (onLeft) return 'w';
                if (onRight) return 'e';
                return null;
            }
            function setCursorForEdge(edge) {
                const mapEl = document.getElementById('previewMap');
                const cursorMap = {
                    n: 'ns-resize', s: 'ns-resize',
                    e: 'ew-resize', w: 'ew-resize',
                    ne: 'nesw-resize', sw: 'nesw-resize',
                    nw: 'nwse-resize', se: 'nwse-resize'
                };
                legend.style.cursor = edge ? cursorMap[edge] || 'default' : 'move';
                if (mapEl) mapEl.style.cursor = legend.style.cursor;
            }
            legend.addEventListener('mousemove', function(e) {
                if (isDraggingLegend || isResizingLegend) return;
                const edge = getHoverEdge(e);
                hoverEdge = edge;
                setCursorForEdge(edge);
            });

            // Define os handlers para 'mousedown'
            legendDragHandler = function(e) {
                // Resize by edges takes precedence
                const edge = hoverEdge;
                if (edge) {
                    isResizingLegend = true;
                    legend.classList.add('resizing');
                    const rect = legend.getBoundingClientRect();
                    const containerRect = mapPreview.getBoundingClientRect();
                    legendStartX = e.clientX;
                    legendStartY = e.clientY;
                    legendStartLeft = rect.left - containerRect.left;
                    legendStartTop = rect.top - containerRect.top;
                    legendStartWidth = rect.width;
                    legendStartHeight = rect.height;
                    legend.dataset.resizeEdge = edge;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // Não inicia drag se clicar no handle de resize ou em itens da legenda
                if (e.target.classList.contains('legend-resize-handle') || 
                    e.target.closest('.legend-item')) return;
                
                isDraggingLegend = true;
                legend.classList.add('dragging');
                
                const rect = legend.getBoundingClientRect();
                const containerRect = mapPreview.getBoundingClientRect();
                
                legendStartX = e.clientX;
                legendStartY = e.clientY;
                legendStartLeft = rect.left - containerRect.left;
                legendStartTop = rect.top - containerRect.top;

                e.preventDefault();
            };

            legendResizeHandler = function(e) {
                isResizingLegend = true;
                legend.classList.add('resizing');
                
                const rect = legend.getBoundingClientRect();
                const containerRect = mapPreview.getBoundingClientRect();
                
                legendStartX = e.clientX;
                legendStartY = e.clientY;
                legendStartLeft = rect.left - containerRect.left;
                legendStartTop = rect.top - containerRect.top;
                legendStartWidth = rect.width;
                legendStartHeight = rect.height;

                e.preventDefault();
                e.stopPropagation();
            };

            // Adiciona os listeners de 'mousedown'
            legend.addEventListener('mousedown', legendDragHandler);
            resizeHandle.addEventListener('mousedown', legendResizeHandler);

            // Movimento do mouse (global) - usa referências atuais
            function createMouseMoveHandler() {
                return function(e) {
                    // ... (código interno de createMouseMoveHandler permanece o mesmo)
                    if (!isDraggingLegend && !isResizingLegend) return;
                    
                    const currentLegend = document.getElementById('legendContainer');
                    const currentMap = document.getElementById('previewMap');
                    if (!currentLegend || !currentMap) return;

                    const mapContainer = currentMap.parentElement;
                    const containerRect = mapContainer.getBoundingClientRect();
                    const deltaX = e.clientX - legendStartX;
                    const deltaY = e.clientY - legendStartY;

                    if (isDraggingLegend) {
                        // Move a legenda
                        let newLeft = legendStartLeft + deltaX;
                        let newTop = legendStartTop + deltaY;

                        // Limita dentro do mapa
                        const maxLeft = containerRect.width - currentLegend.offsetWidth;
                        const maxTop = containerRect.height - currentLegend.offsetHeight;

                        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                        newTop = Math.max(0, Math.min(newTop, maxTop));

                        currentLegend.style.left = newLeft + 'px';
                        currentLegend.style.top = newTop + 'px';
                        currentLegend.style.right = 'auto';
                        currentLegend.style.bottom = 'auto';
                    } else if (isResizingLegend) {
                        // Redimensiona a legenda (por handle ou borda)
                        let newLeft = legendStartLeft;
                        let newTop = legendStartTop;
                        let newWidth = legendStartWidth;
                        let newHeight = legendStartHeight;
                        const edge = currentLegend.dataset.resizeEdge || 'se';

                        if (edge.includes('e')) {
                            newWidth = legendStartWidth + deltaX;
                        }
                        if (edge.includes('s')) {
                            newHeight = legendStartHeight + deltaY;
                        }
                        if (edge.includes('w')) {
                            newWidth = legendStartWidth - deltaX;
                            newLeft = legendStartLeft + deltaX;
                        }
                        if (edge.includes('n')) {
                            newHeight = legendStartHeight - deltaY;
                            newTop = legendStartTop + deltaY;
                        }

                        // Limites
                        const minWidth = 200;
                        const minHeight = 100;
                        const maxWidth = Math.min(400, containerRect.width);
                        const maxHeight = Math.min(containerRect.height * 0.6, containerRect.height);

                        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
                        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
                        // Limitar posição para manter dentro do mapa
                        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - newWidth));
                        newTop = Math.max(0, Math.min(newTop, containerRect.height - newHeight));

                        currentLegend.style.left = newLeft + 'px';
                        currentLegend.style.top = newTop + 'px';
                        currentLegend.style.width = newWidth + 'px';
                        currentLegend.style.height = newHeight + 'px';
                    }
                };
            }

            // Soltar mouse (global)
            function createMouseUpHandler() {
                return function() {
                    // ... (código interno de createMouseUpHandler permanece o mesmo)
                    if (isDraggingLegend || isResizingLegend) {
                        const currentLegend = document.getElementById('legendContainer');
                        if (currentLegend) {
                            currentLegend.classList.remove('dragging', 'resizing');
                            currentLegend.dataset.resizeEdge = '';
                        }
                        isDraggingLegend = false;
                        isResizingLegend = false;
                        if (window.constrainLegend) {
                            window.constrainLegend();
                        }
                        // Reset cursor
                        setCursorForEdge(null);
                    }
                };
            }

            // Remove handlers GLOBAIS anteriores (mousemove, mouseup) se existirem
            if (window.legendMouseMoveHandler) {
                document.removeEventListener('mousemove', window.legendMouseMoveHandler);
            }
            if (window.legendMouseUpHandler) {
                document.removeEventListener('mouseup', window.legendMouseUpHandler);
            }


            // Anexa os novos handlers GLOBAIS
            window.legendMouseMoveHandler = createMouseMoveHandler();
            document.addEventListener('mousemove', window.legendMouseMoveHandler);

            window.legendMouseUpHandler = createMouseUpHandler();
            document.addEventListener('mouseup', window.legendMouseUpHandler);
        }

        /**
         * Configura o drag-and-drop (reordenar) para os ITENS dentro da legenda.
         */
        function setupLegendDragAndDrop() {
            const container = document.getElementById('legendItems');
            if (!container) return;

            let draggedElement = null;

            container.addEventListener('dragstart', function(e) {
                if (e.target.closest('.legend-preview').classList.contains('dragging')) {
                    e.preventDefault();
                    return;
                }
                draggedElement = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            container.addEventListener('dragend', function(e) {
                e.target.classList.remove('dragging');
                container.querySelectorAll('.legend-item').forEach(item => item.classList.remove('drag-over'));
            });

            container.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const afterElement = getDragAfterElement(container, e.clientY);
                const dragging = container.querySelector('.dragging');
                
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            });

            container.addEventListener('dragenter', function(e) {
                if (e.target.classList.contains('legend-item') && e.target !== draggedElement) {
                    e.target.classList.add('drag-over');
                }
            });

            container.addEventListener('dragleave', function(e) {
                e.target.classList.remove('drag-over');
            });

            container.addEventListener('drop', function(e) {
                e.preventDefault();
                container.querySelectorAll('.legend-item').forEach(item => item.classList.remove('drag-over'));
            });
        }

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.legend-item:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        // =========================================================================
        // FUNÇÕES UTILITÁRIAS E INICIALIZAÇÃO
        // =========================================================================

        /**
         * Retorna uma cor padrão baseada no 'tipo' do item.
         */
        function getDefaultColor(tipo) {
            const colors = {
                'Ponto': '#3498db',
                'Linha': '#2ecc71',
                'Polígono': '#27ae60',
                'Círculo': '#3498db',
                'Outros': '#95a5a6'
            };
            return colors[tipo] || '#3498db';
        }
            
        /**
         * Event Listener que inicia a aplicação após o carregamento do DOM.
         */

// Para municipalitySelectMap1
document.getElementById('municipalitySelectMap1').addEventListener('change', async function() {
    updateLocationMap1();

    updatePreview();
    
    // Move o preview para o município
    const cd_mun = this.value;
    const cd_uf = document.getElementById('stateSelectMap1').value;
    
    if (cd_mun && cd_uf && mapPreview) {
        try {
            const municipiosData = await fetchMunicipiosGeoJSON(cd_uf);
            const municipioFeature = municipiosData.features.find(f => f.properties.CD_MUN === cd_mun);
            
            if (municipioFeature) {
                const tempLayer = L.geoJSON(municipioFeature);
                mapPreview.fitBounds(tempLayer.getBounds(), { padding: [50, 50] });
            }
        } catch (error) {
            console.error('Erro ao mover para município:', error);
        }
    }
});

// Para municipalitySelect
document.getElementById('municipalitySelect').addEventListener('change', async function() {
    updateLocationMap2();
    updateLocationMap1(); 
    updatePreview();
    
    // Move o preview para o município
    const cd_mun = this.value;
    const cd_uf = document.getElementById('stateSelect').value;
    
    if (cd_mun && cd_uf && mapPreview) {
        try {
            const municipiosData = await fetchMunicipiosGeoJSON(cd_uf);
            const municipioFeature = municipiosData.features.find(f => f.properties.CD_MUN === cd_mun);
            
            if (municipioFeature) {
                const tempLayer = L.geoJSON(municipioFeature);
                mapPreview.fitBounds(tempLayer.getBounds(), { padding: [50, 50] });
            }
        } catch (error) {
            console.error('Erro ao mover para município:', error);
        }
    }
});




window.addEventListener('DOMContentLoaded', function() {
    // 1. Carrega o título e os dados de fundo (GeoJSONs)
    updateMapPreview(); // Isso já carregará os dados do banco
    loadGeoJSONs(); 
    
 
    
    // 3. Inicializa os inputs de texto
    initializeTextInputs();
    
    // 4. Configura as ações de fechar a janela
    initializeWindowActions(); 
    
    // 5. Remove a chamada antiga para loadMapData() pois agora é feito no updateMapPreview()
});


// =========================================================================
// CONTROLE DE RÓTULOS NO MAPA (CHECKBOX "Mostrar nomes no mapa")
// =========================================================================

/**
 * Conecta o checkbox "Mostrar nomes no mapa" ao CSS via classe no body.
 * Quando marcado, adiciona 'show-map-labels' ao body, ativando os tooltips
 * permanentes vinculados a cada camada via bindTooltip / className:'map-label'.
 */
document.addEventListener('DOMContentLoaded', function () {
    const toggleLabelsCheckbox = document.getElementById('toggleMapLabels');
    if (!toggleLabelsCheckbox) return;

    toggleLabelsCheckbox.addEventListener('change', function () {
        if (this.checked) {
            document.body.classList.add('show-map-labels');
        } else {
            document.body.classList.remove('show-map-labels');
        }
    });
});


    </script>
</body>
</html>