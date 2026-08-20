"""
Renders the guest booking receipt handed over at a local office counter: a
one-page PDF with the tracking number, sender/receiver details, and a QR
code encoding the tracking number (scannable at any hub/rider handoff).
Distinct from `invoice_pdf_service.generate_invoice_pdf` (a billing document)
and from settlement payout receipts - this is what a walk-in guest is
physically handed once their parcel is booked.
"""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.widgetbase import Widget
from reportlab.platypus.flowables import Flowable

from app.models.order import Order
from app.services.invoice_pdf_service import COMPANY_NAME, _money, _address_lines


class _QRFlowable(Flowable):
    """Wraps a reportlab QR widget as a Platypus flowable so it can sit
    inline in the document flow like any other element."""

    def __init__(self, value: str, size: float = 35 * mm):
        super().__init__()
        self.value = value
        self.size = size

    def wrap(self, availWidth, availHeight):
        return self.size, self.size

    def draw(self):
        widget = QrCodeWidget(self.value)
        bounds = widget.getBounds()
        widget_size = bounds[2] - bounds[0]
        scale = self.size / widget_size if widget_size else 1
        drawing = Drawing(self.size, self.size, transform=[scale, 0, 0, scale, 0, 0])
        drawing.add(widget)
        drawing.drawOn(self.canv, 0, 0)


def generate_booking_receipt_pdf(order: Order, office_name: str | None = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Receipt {order.tracking_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReceiptTitle", parent=styles["Title"], fontSize=20, spaceAfter=2)
    heading_style = ParagraphStyle("ReceiptHeading", parent=styles["Heading2"], fontSize=12, spaceAfter=4)
    normal = styles["Normal"]
    muted = ParagraphStyle("Muted", parent=styles["Normal"], textColor=colors.grey)

    elements = []

    booked_at = order.created_at.strftime("%d %b %Y, %I:%M %p") if order.created_at else "-"

    header_table = Table(
        [
            [
                Paragraph(COMPANY_NAME, title_style),
                _QRFlowable(order.tracking_number),
            ],
            [
                Paragraph(
                    f"<b>Tracking #</b> {order.tracking_number}<br/>"
                    f"<b>Status</b> Booked<br/>"
                    f"<b>Booked</b> {booked_at}<br/>"
                    + (f"<b>Local Office</b> {office_name}<br/>" if office_name else ""),
                    normal,
                ),
                "",
            ],
        ],
        colWidths=[130 * mm, 40 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("SPAN", (1, 0), (1, 1))]))
    elements.append(header_table)
    elements.append(Spacer(1, 10 * mm))

    address_table = Table(
        [
            [Paragraph("Sender", heading_style), Paragraph("Receiver", heading_style)],
            [
                Paragraph(_address_lines(order.pickup_address), normal),
                Paragraph(_address_lines(order.dropoff_address), normal),
            ],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    address_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ]
        )
    )
    elements.append(address_table)
    elements.append(Spacer(1, 8 * mm))

    weight = f"{order.package_weight_kg} kg" if order.package_weight_kg is not None else "-"
    description = order.package_description or "-"

    elements.append(Paragraph("Package Details", heading_style))
    package_table = Table(
        [
            ["Description", "Weight", "Amount"],
            [description, weight, _money(order.final_price)],
        ],
        colWidths=[100 * mm, 30 * mm, 40 * mm],
    )
    package_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(package_table)
    elements.append(Spacer(1, 12 * mm))
    elements.append(Paragraph("Scan the QR code above to track this parcel.", muted))
    elements.append(Paragraph(f"Thank you for shipping with {COMPANY_NAME}.", muted))

    doc.build(elements)
    return buffer.getvalue()
