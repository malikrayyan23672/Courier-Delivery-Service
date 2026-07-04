from app.tasks.celery_app import celery_app


@celery_app.task
def send_order_confirmation(order_id: str, customer_email: str):
    """
    Placeholder. Wire up SendGrid/SES here.
    Kept as a background task so a slow email provider never blocks
    the order-creation request/response cycle.
    """
    print(f"[stub] Sending order confirmation for {order_id} to {customer_email}")
