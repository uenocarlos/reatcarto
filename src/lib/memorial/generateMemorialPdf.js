import { jsPDF } from 'jspdf';
import { formatDegreesMinutesSeconds } from './geometry.js';

const PAGE_MARGIN = 12;
const HEADER_HEIGHT = 14;
const ROW_HEIGHT = 7;
const FOOTER_HEIGHT = 10;
const COLUMN_WIDTHS = [22, 45, 45, 32, 43, 43, 43];

function cleanFilePart(value) {
  return String(value || 'memorial-descritivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'memorial-descritivo';
}

function formatMetric(value, decimals = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function centeredText(doc, text, x, y, width) {
  doc.text(String(text), x + width / 2, y, { align: 'center' });
}

function drawFilledCell(doc, x, y, width, height, fillColor) {
  doc.setFillColor(...fillColor);
  doc.rect(x, y, width, height, 'FD');
}

function drawDocumentHeader(doc, { title, mapName, polygonName, memorial }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setTextColor(28, 48, 62);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleLines = doc.splitTextToSize(String(title).toUpperCase(), pageWidth - PAGE_MARGIN * 2);
  const renderedTitleLines = titleLines.slice(0, 2);
  doc.text(renderedTitleLines, pageWidth / 2, 12, { align: 'center' });
  const identificationY = 18 + (renderedTitleLines.length - 1) * 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  const identification = [mapName && `Mapa: ${mapName}`, polygonName && `Polígono: ${polygonName}`]
    .filter(Boolean)
    .join('  |  ');
  if (identification) doc.text(identification, pageWidth / 2, identificationY, { align: 'center' });
  const metadataY = identification ? identificationY + 5 : identificationY;
  const convergenceSign = memorial.convergence >= 0 ? '+' : '-';
  const metadata = `UTM ${memorial.zoneLabel}  |  Meridiano central: ${memorial.centralMeridian}°  |  `
    + `Convergência: ${formatDegreesMinutesSeconds(Math.abs(memorial.convergence))} (${convergenceSign})  |  `
    + `Vértices: ${memorial.vertexCount}`;
  doc.text(metadata, pageWidth / 2, metadataY, { align: 'center' });
  return metadataY + 5;
}

function columnX(index) {
  return PAGE_MARGIN + COLUMN_WIDTHS.slice(0, index).reduce((sum, width) => sum + width, 0);
}

function drawTableHeader(doc, startY) {
  doc.setDrawColor(210, 215, 218);
  doc.setLineWidth(0.2);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const twoRowCells = [
    { index: 0, label: 'VÉRTICE' },
    { index: 3, label: 'LADO' },
    { index: 6, label: 'DISTÂNCIA (m)' },
  ];
  for (const cell of twoRowCells) {
    const x = columnX(cell.index);
    drawFilledCell(doc, x, startY, COLUMN_WIDTHS[cell.index], HEADER_HEIGHT, [45, 67, 82]);
    doc.setTextColor(255, 255, 255);
    centeredText(doc, cell.label, x, startY + 8.5, COLUMN_WIDTHS[cell.index]);
  }

  const coordinateX = columnX(1);
  const coordinateWidth = COLUMN_WIDTHS[1] + COLUMN_WIDTHS[2];
  drawFilledCell(doc, coordinateX, startY, coordinateWidth, HEADER_HEIGHT / 2, [45, 67, 82]);
  doc.setTextColor(255, 255, 255);
  centeredText(doc, 'COORDENADAS', coordinateX, startY + 4.7, coordinateWidth);
  const azimuthX = columnX(4);
  const azimuthWidth = COLUMN_WIDTHS[4] + COLUMN_WIDTHS[5];
  drawFilledCell(doc, azimuthX, startY, azimuthWidth, HEADER_HEIGHT / 2, [45, 67, 82]);
  doc.setTextColor(255, 255, 255);
  centeredText(doc, 'AZIMUTES', azimuthX, startY + 4.7, azimuthWidth);

  const subheaders = [
    { index: 1, label: 'E (m)' },
    { index: 2, label: 'N (m)' },
    { index: 4, label: 'PLANO' },
    { index: 5, label: 'REAL' },
  ];
  for (const cell of subheaders) {
    const x = columnX(cell.index);
    drawFilledCell(doc, x, startY + HEADER_HEIGHT / 2, COLUMN_WIDTHS[cell.index], HEADER_HEIGHT / 2, [45, 67, 82]);
    doc.setTextColor(255, 255, 255);
    centeredText(doc, cell.label, x, startY + 11.7, COLUMN_WIDTHS[cell.index]);
  }
  return startY + HEADER_HEIGHT;
}

function rowValues(row) {
  return [
    row.vertex,
    formatMetric(row.easting),
    formatMetric(row.northing),
    row.side,
    formatDegreesMinutesSeconds(row.gridAzimuth),
    formatDegreesMinutesSeconds(row.trueAzimuth),
    formatMetric(row.distance),
  ];
}

function drawRow(doc, row, rowIndex, y) {
  const fillColor = rowIndex % 2 === 0 ? [250, 251, 252] : [239, 243, 245];
  doc.setDrawColor(210, 215, 218);
  doc.setTextColor(35, 35, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let x = PAGE_MARGIN;
  for (const [index, value] of rowValues(row).entries()) {
    drawFilledCell(doc, x, y, COLUMN_WIDTHS[index], ROW_HEIGHT, fillColor);
    doc.setTextColor(35, 35, 35);
    centeredText(doc, value, x, y + 4.7, COLUMN_WIDTHS[index]);
    x += COLUMN_WIDTHS[index];
  }
}

function drawFooters(doc, generatedAt) {
  const pages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(generatedAt);
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(210, 215, 218);
    doc.line(PAGE_MARGIN, pageHeight - 9, pageWidth - PAGE_MARGIN, pageHeight - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(105, 105, 105);
    doc.text(`Gerado em ${dateLabel}`, PAGE_MARGIN, pageHeight - 5);
    doc.text(`Página ${page} de ${pages}`, pageWidth - PAGE_MARGIN, pageHeight - 5, { align: 'right' });
  }
}

export function createMemorialPdf({
  memorial,
  title = 'Memorial Descritivo Sintético',
  mapName = '',
  polygonName = '',
  generatedAt = new Date(),
}, dependencies = {}) {
  if (!memorial?.rows?.length) throw new Error('Não há vértices para gerar o memorial.');
  const JsPdf = dependencies.jsPDF ?? jsPDF;
  const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const context = { title, mapName, polygonName, memorial };
  let y = drawTableHeader(doc, drawDocumentHeader(doc, context));
  memorial.rows.forEach((row, index) => {
    if (y + ROW_HEIGHT > pageHeight - FOOTER_HEIGHT - 4) {
      doc.addPage();
      y = drawTableHeader(doc, drawDocumentHeader(doc, context));
    }
    drawRow(doc, row, index, y);
    y += ROW_HEIGHT;
  });
  if (y + 9 > pageHeight - FOOTER_HEIGHT) {
    doc.addPage();
    y = drawDocumentHeader(doc, context) + 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(28, 48, 62);
  doc.text(
    `Área projetada: ${formatMetric(memorial.area)} m²  |  Perímetro: ${formatMetric(memorial.perimeter)} m`,
    PAGE_MARGIN,
    y + 6,
  );
  drawFooters(doc, generatedAt);
  const fileName = `${cleanFilePart(title)}.pdf`;
  return { doc, fileName };
}

export function saveMemorialPdf(options, dependencies) {
  const result = createMemorialPdf(options, dependencies);
  result.doc.save(result.fileName);
  return { fileName: result.fileName, mimeType: 'application/pdf' };
}
