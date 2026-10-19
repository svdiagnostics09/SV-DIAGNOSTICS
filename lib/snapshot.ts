import { getPendingWork, getSetting, getStats, getTopTests, listActivity, listMessages, listNotifications, listOrders, listPatients, listRecentEvents, listTests, publicSettings, unreadNotificationCount } from '@/lib/store'

/**
 * The one payload the UI renders. Every field is read from SQLite at the
 * moment of the request, so nothing here is invented client-side.
 */
export async function buildSnapshot() {
  const [settings, testsResult, ordersResult, patients, pending, topTests, recentEvents, activity, messages, notifications, unreadNotifications, adminWhatsapp, phoneNumberId, whatsappAccessToken, stats, logo] = await Promise.all([
    publicSettings(), listTests(), listOrders(), listPatients(), getPendingWork(), getTopTests(), listRecentEvents(60), listActivity(), listMessages(), listNotifications(40), unreadNotificationCount(), getSetting('admin_whatsapp'), getSetting('whatsapp_phone_number_id'), getSetting('whatsapp_access_token'), getStats(), getSetting('logo_data_url'),
  ])
  const tests = testsResult.map((test) => ({
    id: test.id,
    name: test.name,
    category: test.category,
    description: test.description,
    price: test.price,
    finalPrice: test.finalPrice,
    discountType: test.discountType,
    discountValue: test.discountValue,
    discountLabel: test.discountLabel,
    sampleType: test.sampleType,
    reportHours: test.reportHours,
    prep: test.prep,
  }))

  return {
    ...settings,
    tests,
    orders: ordersResult.map((order) => ({
      id: order.id,
      orderId: order.order_id,
      patientName: order.patient_name,
      phone: order.phone,
      testName: order.test_name,
      type: order.type,
      slot: order.slot,
      amount: order.amount,
      status: order.status,
      hasReport: order.hasReport,
      reportReadyAt: order.reportReadyAt,
      whatsappSentAt: order.whatsappSentAt,
      reportFilename: order.report_filename,
      reportSize: order.report_size,
      reportUploadedAt: order.report_uploaded_at,
      reportNotes: order.report_notes,
      staffNote: order.staff_note,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      pincode: order.pincode,
      cancelledAt: order.cancelled_at,
      createdAt: order.created_at,
    })),
    patients, pending, topTests, recentEvents, activity, messages, notifications, unreadNotifications,
    notifyWhatsAppEnabled: Boolean(adminWhatsapp),
    whatsappAutoSend: Boolean(phoneNumberId && whatsappAccessToken),
    stats,
    updatedAt: Date.now(),
    brandCustomised: Boolean(logo),
  }
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>
