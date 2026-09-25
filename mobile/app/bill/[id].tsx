import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import { Badge, Btn, Divider, ErrorBox, Header, Loading, Petal, Row, Screen } from '../../src/components/ui';
import { Typewriter } from '../../src/components/motion';
import { C, F, T } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { useLoad } from '../../src/lib/hooks';
import { formatDate, formatTime, qtyLabel } from '../../src/lib/format';
import { rupees } from '../../src/lib/money';
import { billHtml, billText, openWhatsApp } from '../../src/lib/share';
import * as api from '../../src/lib/api';

export default function BillScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const q = useLoad(() => api.getBill(id), [id]);
  const bill = q.data;

  if (q.loading && !bill) return <Screen edges={['top', 'bottom']}><Header title="Bill" back /><Loading /></Screen>;
  if (!bill) return <Screen edges={['top', 'bottom']}><Header title="Bill" back /><ErrorBox message={q.error ?? 'We could not open this bill.'} onRetry={q.reload} /></Screen>;

  const shop = bill.shops;
  const isOwner = shop?.owner_id === user?.id;
  const status = bill.payment_status;

  async function print() {
    try { await Print.printAsync({ html: billHtml(bill!) }); }
    catch (e: any) { Alert.alert('Could not print', 'Printing is not available on this phone right now.'); }
  }
  const home = () => router.replace(isOwner ? '/dashboard' : '/home');

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={fresh ? 'Bill saved' : `Bill #${bill.bill_number}`} back={!fresh} animate={!!fresh} />
      {fresh ? <Text style={[T.body, { marginBottom: 14 }]}>Stock and khata are updated. Here is the receipt.</Text> : null}

      <Petal color={C.white} style={{ padding: 20, borderWidth: 1.5, borderColor: C.line }}>
        <Text style={{ fontFamily: F.display, fontSize: 32, lineHeight: 42, color: C.plum, textAlign: 'center' }}>{shop?.name}</Text>
        <Text style={[T.small, { textAlign: 'center' }]}>{[shop?.address_line, shop?.area, shop?.city].filter(Boolean).join(', ')}</Text>
        {shop?.phone ? <Text style={[T.small, { textAlign: 'center' }]}>{shop.phone}</Text> : null}
        <Divider />
        <Row left={`Bill #${bill.bill_number}`} right={`${formatDate(bill.created_at)}, ${formatTime(bill.created_at)}`} />
        <Row left="Customer" right={bill.shop_customers?.name ?? ''} bold />
        <Divider />
        {(bill.bill_items ?? []).map((it) => (
          <View key={it.id} style={{ marginBottom: 8 }}>
            <Text style={T.h3}>{it.product_name_snapshot}</Text>
            <Row left={`${qtyLabel(it.quantity, it.unit)} × ${rupees(it.unit_price)}`} right={rupees(it.line_total)} />
          </View>
        ))}
        <Divider />
        {bill.discount > 0 ? <Row left="Discount" right={`- ${rupees(bill.discount)}`} /> : null}
        <Row left="TOTAL" right={rupees(bill.total_amount)} bold />
        <Row left="PAID" right={rupees(bill.amount_paid)} />
        <Row left="DUE" right={rupees(bill.amount_due)} bold />
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <Badge label={status === 'paid' ? 'Paid in full' : status === 'partially_paid' ? 'Partly paid' : 'On khata'} tone={status === 'paid' ? 'green' : 'red'} />
        </View>
        {bill.notes ? <Text style={[T.small, { marginTop: 10, textAlign: 'center' }]}>{bill.notes}</Text> : null}
      </Petal>

      <View style={{ gap: 10, marginTop: 18 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label="Print" icon="printer" variant="soft" style={{ flex: 1 }} onPress={print} />
          <Btn label="Share" icon="share-2" variant="soft" style={{ flex: 1 }} onPress={() => openWhatsApp(billText(bill), isOwner ? bill.shop_customers?.phone : null)} />
        </View>
        {isOwner && bill.amount_due > 0 ? <Btn label="Open khata to record payment" variant="ghost" onPress={() => router.push(`/ledger/${bill.shop_customer_id}`)} /> : null}
        <Btn label="Done" onPress={fresh ? home : () => (router.canGoBack() ? router.back() : home())} />
      </View>
      <Text style={[T.small, { textAlign: 'center', marginTop: 10 }]}>Sharing opens WhatsApp with a text summary. Nothing is sent until you press send.</Text>
    </Screen>
  );
}
