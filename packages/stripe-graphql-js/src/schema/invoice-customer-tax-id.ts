import { builder } from '../builder'

builder.objectType('StripeInvoiceCustomerTaxId', {
  fields: (t) => ({
    type: t.exposeString('type', {
      description: `The type of the tax ID, one of \`eu_vat\`, \`br_cnpj\`, \`br_cpf\`, \`eu_oss_vat\`, \`gb_vat\`, \`nz_gst\`, \`au_abn\`, \`au_arn\`, \`in_gst\`, \`no_vat\`, \`za_vat\`, \`ch_vat\`, \`mx_rfc\`, \`sg_uen\`, \`ru_inn\`, \`ru_kpp\`, \`ca_bn\`, \`hk_br\`, \`es_cif\`, \`tw_vat\`, \`th_vat\`, \`jp_cn\`, \`jp_rn\`, \`li_uid\`, \`my_itn\`, \`us_ein\`, \`kr_brn\`, \`ca_qst\`, \`ca_gst_hst\`, \`ca_pst_bc\`, \`ca_pst_mb\`, \`ca_pst_sk\`, \`my_sst\`, \`sg_gst\`, \`ae_trn\`, \`cl_tin\`, \`sa_vat\`, \`id_npwp\`, \`my_frp\`, \`il_vat\`, \`ge_vat\`, \`ua_vat\`, \`is_vat\`, \`bg_uic\`, \`hu_tin\`, \`si_tin\`, or \`unknown\``
    }),
    value: t.exposeString('value', {
      description: `The value of the tax ID.`,
      nullable: true
    })
  })
})
