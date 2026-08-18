"""
Renders a one-page PDF invoice using reportlab's Platypus layer (SimpleDocTemplate
+ Table/Paragraph), returned as in-memory bytes - no filesystem writes, so the
caller (an API route) can stream it straight back in a Response.
"""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from app.models.invoice import Invoice
from app.models.order import Order

COMPANY_NAME = "Raftaar Express"


def _money(value: float | None) -> str:
    return f"Rs. {value:,.2f}" if value is not None else "-"


def _address_lines(address) -> str:
    if address is None:
        return "-"
    parts = [address.full_address]
    if address.city:
        parts.append(address.city)
    contact_bits = [b for b in (address.contact_name, address.contact_phone) if b]
    lines = [", ".join(parts)]
    if contact_bits:
        lines.append(" / ".join(contact_bits))
    return "<br/>".join(lines)


def generate_invoice_pdf(invoice: Invoice, order: Order) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Invoice {invoice.invoice_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvoiceTitle", parent=styles["Title"], fontSize=20, spaceAfter=2)
    heading_style = ParagraphStyle("InvoiceHeading", parent=styles["Heading2"], fontSize=12, spaceAfter=4)
    normal = styles["Normal"]
    muted = ParagraphStyle("Muted", parent=styles["Normal"], textColor=colors.grey)

    elements = []

    issued_at = invoice.created_at.strftime("%d %b %Y, %I:%M %p") if invoice.created_at else "-"

    header_table = Table(
        [
            [
                Paragraph(COMPANY_NAME, title_style),
                Paragraph(
                    f"<b>Invoice #</b> {invoice.invoice_number}<br/>"
                    f"<b>Tracking #</b> {order.tracking_number}<br/>"
                    f"<b>Issued</b> {issued_at}<br/>"
                    f"<b>Status</b> {invoice.status}",
                    normal,
                ),
            ]
        ],
        colWidths=[90 * mm, 80 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(header_table)
    elements.append(Spacer(1, 10 * mm))

    address_table = Table(
        [
            [Paragraph("Pickup Address", heading_style), Paragraph("Dropoff Address", heading_style)],
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
        [["Description", "Weight"], [description, weight]],
        colWidths=[130 * mm, 40 * mm],
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
    elements.append(Spacer(1, 10 * mm))

    elements.append(Paragraph("Summary", heading_style))
    totals_rows = [["Subtotal", _money(invoice.subtotal)]]
    if invoice.discount_amount:
        totals_rows.append(["Discount", f"- {_money(invoice.discount_amount)}"])
    totals_rows.append(["Tax", _money(invoice.tax_amount or 0.0)])
    totals_rows.append(["Total", _money(invoice.total_amount)])

    totals_table = Table(totals_rows, colWidths=[130 * mm, 40 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.black),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(totals_table)
    elements.append(Spacer(1, 12 * mm))
    elements.append(Paragraph(f"Thank you for shipping with {COMPANY_NAME}.", muted))

    doc.build(elements)
    return buffer.getvalue()
