"""
Renders the parcel shipping label: a compact 4x6in PDF meant to be printed
and physically stuck on the parcel itself - tracking number, a scannable QR
code, sender/receiver, and weight/COD, at hub-handoff-glance size. Distinct
from `invoice_pdf_service.generate_invoice_pdf` (the customer's itemized
billing document, A4) and from `receipt_pdf_service.generate_booking_receipt_pdf`
(the guest's own take-home copy) - this one never leaves the branch/hub/
local office, it travels with the parcel.
"""
import io

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from app.models.order import Order
from app.models.payment import PaymentMethod
from app.services.invoice_pdf_service import COMPANY_NAME, _address_lines
from app.services.receipt_pdf_service import _QRFlowable

LABEL_PAGE_SIZE = (4 * inch, 6 * inch)


def generate_shipping_label_pdf(order: Order, location_name: str | None = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LABEL_PAGE_SIZE,
        leftMargin=6 * mm,
        rightMargin=6 * mm,
        topMargin=6 * mm,
        bottomMargin=6 * mm,
        title=f"Label {order.tracking_number}",
    )

    styles = getSampleStyleSheet()
    company_style = ParagraphStyle("LabelCompany", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
    tracking_style = ParagraphStyle("LabelTracking", parent=styles["Title"], fontSize=22, leading=24, spaceAfter=0)
    heading_style = ParagraphStyle("LabelHeading", parent=styles["Normal"], fontSize=8, textColor=colors.grey, spaceAfter=1)
    address_style = ParagraphStyle("LabelAddress", parent=styles["Normal"], fontSize=10, leading=13)
    meta_style = ParagraphStyle("LabelMeta", parent=styles["Normal"], fontSize=9)

    elements = [Paragraph(COMPANY_NAME.upper(), company_style), Spacer(1, 2 * mm)]

    header_table = Table(
        [[Paragraph(order.tracking_number, tracking_style), _QRFlowable(order.tracking_number, size=28 * mm)]],
        colWidths=[65 * mm, 30 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph("FROM (SENDER)", heading_style))
    elements.append(Paragraph(_address_lines(order.pickup_address), address_style))
    elements.append(Spacer(1, 3 * mm))

    elements.append(Paragraph("TO (RECEIVER)", heading_style))
    elements.append(Paragraph(_address_lines(order.dropoff_address), address_style))
    elements.append(Spacer(1, 4 * mm))

    weight = f"{order.package_weight_kg} kg" if order.package_weight_kg is not None else "-"
    is_cod = bool(order.payment and order.payment.method == PaymentMethod.cash and order.payment.status != "paid")
    cod_amount = f"Rs. {order.final_price:,.2f}" if is_cod and order.final_price is not None else None

    meta_rows = [["Weight", weight], ["Booked at", location_name or "-"]]
    if cod_amount:
        meta_rows.append(["COD to collect", cod_amount])

    meta_table = Table(meta_rows, colWidths=[35 * mm, 60 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph(order.package_description or "-", meta_style))

    doc.build(elements)
    return buffer.getvalue()
