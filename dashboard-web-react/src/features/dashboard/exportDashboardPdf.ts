import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/** Screenshots the dashboard DOM (charts included) into a paginated A4 PDF —
 * simplest way to get "biểu đồ" into the report without re-drawing each chart natively in jsPDF. */
export async function exportDashboardPdf(el: HTMLElement, title: string) {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.setFontSize(14);
  pdf.text(title, margin, margin + 4);
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(`Xuất lúc: ${new Date().toLocaleString('vi-VN')}`, margin, margin + 10);

  const imgData = canvas.toDataURL('image/png');
  let heightLeft = imgHeight;
  let position = margin + 16;
  const usableHeight = pageHeight - margin * 2;

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= usableHeight - 16;

  while (heightLeft > 0) {
    pdf.addPage();
    position = margin - (imgHeight - heightLeft);
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
  }

  pdf.save(`bao-cao-tong-hop-${new Date().toISOString().slice(0, 10)}.pdf`);
}
