DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'payments_touch'
      AND tgrelid = 'public.customer_payments'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER payments_touch
      BEFORE UPDATE ON public.customer_payments
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END
$$;
