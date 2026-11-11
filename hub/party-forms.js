// hub/party-forms.js: the party forms, moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html.
/* ==========================================================================
   PARTY FORMS — copied as-is from index.html (the schedule's Day view), with
   everything it uses: party details form, add-on parsing, pricing tables,
   tax by province, credit/charge calculator, gift card, POS order number and
   thank-you email. Keep in step with index.html until the Day view retires.
   The Hub supplies: currentStudioId (set when a form opens), SUPABASE_KEY.
   ========================================================================== */
var currentStudioId = null;
var SUPABASE_KEY = SUPABASE_ANON_KEY;
function jsArg(v) { return escText(JSON.stringify(v == null ? '' : String(v))) }

function escText(v) { return v == null ? '' : String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }

const TAX_RATES = { 'ON': 0.13, 'BC': 0.05, 'AB': 0.05 }

function getTaxRate(studioId) {
  const prefix = (studioId || '').split('-')[0]
  return TAX_RATES[prefix] || 0.05
}

const KIDS_PRICES = {
  "no - 60 minutes for the art project is good!|no - just we will leave after the art portion|up to 8 people (base price)":0,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|9 people":16,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|10 people":32,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|11 people":48,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|12 people":64,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|13 people":80,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|14 people":96,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|15 people":112,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|16 people":168,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|17 people":184,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|18 people":200,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|19 people":216,"no - 60 minutes for the art project is good!|no - just we will leave after the art portion|20 people":232,
  "no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|up to 8 people (base price)":64,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|9 people":88,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|10 people":112,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|11 people":136,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|12 people":160,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|13 people":184,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|14 people":208,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|15 people":232,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|16 people":296,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|17 people":320,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|18 people":344,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|19 people":368,"no - 60 minutes for the art project is good!|yes - add 30 minutes (enough time for cake only)|20 people":392,
  "no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|up to 8 people (base price)":96,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|9 people":124,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|10 people":152,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|11 people":180,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|12 people":208,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|13 people":236,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|14 people":264,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|15 people":292,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|16 people":360,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|17 people":388,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|18 people":416,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|19 people":444,"no - 60 minutes for the art project is good!|yes - add 45 minutes (enough time for lunch/snacks and cake)|20 people":472,
  "yes - 90 minutes of art time|no - just we will leave after the art portion|up to 8 people (base price)":64,"yes - 90 minutes of art time|no - just we will leave after the art portion|9 people":88,"yes - 90 minutes of art time|no - just we will leave after the art portion|10 people":112,"yes - 90 minutes of art time|no - just we will leave after the art portion|11 people":136,"yes - 90 minutes of art time|no - just we will leave after the art portion|12 people":160,"yes - 90 minutes of art time|no - just we will leave after the art portion|13 people":184,"yes - 90 minutes of art time|no - just we will leave after the art portion|14 people":208,"yes - 90 minutes of art time|no - just we will leave after the art portion|15 people":232,"yes - 90 minutes of art time|no - just we will leave after the art portion|16 people":316,"yes - 90 minutes of art time|no - just we will leave after the art portion|17 people":340,"yes - 90 minutes of art time|no - just we will leave after the art portion|18 people":364,"yes - 90 minutes of art time|no - just we will leave after the art portion|19 people":388,"yes - 90 minutes of art time|no - just we will leave after the art portion|20 people":412,
  "yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|up to 8 people (base price)":128,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|9 people":160,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|10 people":192,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|11 people":224,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|12 people":256,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|13 people":288,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|14 people":320,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|15 people":352,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|16 people":444,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|17 people":476,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|18 people":508,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|19 people":540,"yes - 90 minutes of art time|yes - add 30 minutes (enough time for cake only)|20 people":572,
  "yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|up to 8 people (base price)":160,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|9 people":196,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|10 people":232,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|11 people":268,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|12 people":304,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|13 people":340,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|14 people":376,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|15 people":412,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|16 people":508,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|17 people":544,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|18 people":580,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|19 people":616,"yes - 90 minutes of art time|yes - add 45 minutes (enough time for lunch/snacks and cake)|20 people":652
}

const SPLATTER_PRICES = {
  "no - just we will leave after the art portion|up to 8 people (base price)|no - watercolour paper is fine":0,"no - just we will leave after the art portion|up to 8 people (base price)|yes please! ($6/pp)":48,"no - just we will leave after the art portion|9 people|no - watercolour paper is fine":16,"no - just we will leave after the art portion|9 people|yes please! ($6/pp)":70,"no - just we will leave after the art portion|10 people|no - watercolour paper is fine":32,"no - just we will leave after the art portion|10 people|yes please! ($6/pp)":92,"no - just we will leave after the art portion|11 people|no - watercolour paper is fine":48,"no - just we will leave after the art portion|11 people|yes please! ($6/pp)":114,"no - just we will leave after the art portion|12 people|no - watercolour paper is fine":64,"no - just we will leave after the art portion|12 people|yes please! ($6/pp)":136,"no - just we will leave after the art portion|13 people|no - watercolour paper is fine":80,"no - just we will leave after the art portion|13 people|yes please! ($6/pp)":158,"no - just we will leave after the art portion|14 people|no - watercolour paper is fine":96,"no - just we will leave after the art portion|14 people|yes please! ($6/pp)":180,"no - just we will leave after the art portion|15 people|no - watercolour paper is fine":112,"no - just we will leave after the art portion|15 people|yes please! ($6/pp)":202,"no - just we will leave after the art portion|16 people|no - watercolour paper is fine":168,"no - just we will leave after the art portion|16 people|yes please! ($6/pp)":264,"no - just we will leave after the art portion|17 people|no - watercolour paper is fine":184,"no - just we will leave after the art portion|17 people|yes please! ($6/pp)":286,"no - just we will leave after the art portion|18 people|no - watercolour paper is fine":200,"no - just we will leave after the art portion|18 people|yes please! ($6/pp)":308,"no - just we will leave after the art portion|19 people|no - watercolour paper is fine":216,"no - just we will leave after the art portion|19 people|yes please! ($6/pp)":330,"no - just we will leave after the art portion|20 people|no - watercolour paper is fine":232,"no - just we will leave after the art portion|20 people|yes please! ($6/pp)":352,
  "yes - add 30 minutes (enough time for cake only)|up to 8 people (base price)|no - watercolour paper is fine":64,"yes - add 30 minutes (enough time for cake only)|up to 8 people (base price)|yes please! ($6/pp)":112,"yes - add 30 minutes (enough time for cake only)|9 people|no - watercolour paper is fine":88,"yes - add 30 minutes (enough time for cake only)|9 people|yes please! ($6/pp)":142,"yes - add 30 minutes (enough time for cake only)|10 people|no - watercolour paper is fine":112,"yes - add 30 minutes (enough time for cake only)|10 people|yes please! ($6/pp)":172,"yes - add 30 minutes (enough time for cake only)|11 people|no - watercolour paper is fine":136,"yes - add 30 minutes (enough time for cake only)|11 people|yes please! ($6/pp)":202,"yes - add 30 minutes (enough time for cake only)|12 people|no - watercolour paper is fine":160,"yes - add 30 minutes (enough time for cake only)|12 people|yes please! ($6/pp)":232,"yes - add 30 minutes (enough time for cake only)|13 people|no - watercolour paper is fine":184,"yes - add 30 minutes (enough time for cake only)|13 people|yes please! ($6/pp)":262,"yes - add 30 minutes (enough time for cake only)|14 people|no - watercolour paper is fine":208,"yes - add 30 minutes (enough time for cake only)|14 people|yes please! ($6/pp)":292,"yes - add 30 minutes (enough time for cake only)|15 people|no - watercolour paper is fine":232,"yes - add 30 minutes (enough time for cake only)|15 people|yes please! ($6/pp)":322,"yes - add 30 minutes (enough time for cake only)|16 people|no - watercolour paper is fine":296,"yes - add 30 minutes (enough time for cake only)|16 people|yes please! ($6/pp)":392,"yes - add 30 minutes (enough time for cake only)|17 people|no - watercolour paper is fine":320,"yes - add 30 minutes (enough time for cake only)|17 people|yes please! ($6/pp)":422,"yes - add 30 minutes (enough time for cake only)|18 people|no - watercolour paper is fine":344,"yes - add 30 minutes (enough time for cake only)|18 people|yes please! ($6/pp)":452,"yes - add 30 minutes (enough time for cake only)|19 people|no - watercolour paper is fine":368,"yes - add 30 minutes (enough time for cake only)|19 people|yes please! ($6/pp)":482,"yes - add 30 minutes (enough time for cake only)|20 people|no - watercolour paper is fine":392,"yes - add 30 minutes (enough time for cake only)|20 people|yes please! ($6/pp)":512,
  "yes - add 45 minutes (enough time for lunch/snacks and cake)|up to 8 people (base price)|no - watercolour paper is fine":96,"yes - add 45 minutes (enough time for lunch/snacks and cake)|up to 8 people (base price)|yes please! ($6/pp)":144,"yes - add 45 minutes (enough time for lunch/snacks and cake)|9 people|no - watercolour paper is fine":124,"yes - add 45 minutes (enough time for lunch/snacks and cake)|9 people|yes please! ($6/pp)":178,"yes - add 45 minutes (enough time for lunch/snacks and cake)|10 people|no - watercolour paper is fine":152,"yes - add 45 minutes (enough time for lunch/snacks and cake)|10 people|yes please! ($6/pp)":212,"yes - add 45 minutes (enough time for lunch/snacks and cake)|11 people|no - watercolour paper is fine":180,"yes - add 45 minutes (enough time for lunch/snacks and cake)|11 people|yes please! ($6/pp)":246,"yes - add 45 minutes (enough time for lunch/snacks and cake)|12 people|no - watercolour paper is fine":208,"yes - add 45 minutes (enough time for lunch/snacks and cake)|12 people|yes please! ($6/pp)":280,"yes - add 45 minutes (enough time for lunch/snacks and cake)|13 people|no - watercolour paper is fine":236,"yes - add 45 minutes (enough time for lunch/snacks and cake)|13 people|yes please! ($6/pp)":314,"yes - add 45 minutes (enough time for lunch/snacks and cake)|14 people|no - watercolour paper is fine":264,"yes - add 45 minutes (enough time for lunch/snacks and cake)|14 people|yes please! ($6/pp)":348,"yes - add 45 minutes (enough time for lunch/snacks and cake)|15 people|no - watercolour paper is fine":292,"yes - add 45 minutes (enough time for lunch/snacks and cake)|15 people|yes please! ($6/pp)":382,"yes - add 45 minutes (enough time for lunch/snacks and cake)|16 people|no - watercolour paper is fine":360,"yes - add 45 minutes (enough time for lunch/snacks and cake)|16 people|yes please! ($6/pp)":456,"yes - add 45 minutes (enough time for lunch/snacks and cake)|17 people|no - watercolour paper is fine":388,"yes - add 45 minutes (enough time for lunch/snacks and cake)|17 people|yes please! ($6/pp)":490,"yes - add 45 minutes (enough time for lunch/snacks and cake)|18 people|no - watercolour paper is fine":416,"yes - add 45 minutes (enough time for lunch/snacks and cake)|18 people|yes please! ($6/pp)":524,"yes - add 45 minutes (enough time for lunch/snacks and cake)|19 people|no - watercolour paper is fine":444,"yes - add 45 minutes (enough time for lunch/snacks and cake)|19 people|yes please! ($6/pp)":558,"yes - add 45 minutes (enough time for lunch/snacks and cake)|20 people|no - watercolour paper is fine":472,"yes - add 45 minutes (enough time for lunch/snacks and cake)|20 people|yes please! ($6/pp)":592
}

const ADULT_PRICES = {
  "up to 10 people (base price)|no - just we will leave after the art portion":0,"up to 10 people (base price)|yes - add 30 minutes":80,"up to 10 people (base price)|yes - add 60 minutes":160,
  "11 people|no - just we will leave after the art portion":25,"11 people|yes - add 30 minutes":113,"11 people|yes - add 60 minutes":201,"12 people|no - just we will leave after the art portion":50,"12 people|yes - add 30 minutes":146,"12 people|yes - add 60 minutes":242,"13 people|no - just we will leave after the art portion":75,"13 people|yes - add 30 minutes":179,"13 people|yes - add 60 minutes":283,"14 people|no - just we will leave after the art portion":100,"14 people|yes - add 30 minutes":212,"14 people|yes - add 60 minutes":324,"15 people|no - just we will leave after the art portion":125,"15 people|yes - add 30 minutes":245,"15 people|yes - add 60 minutes":365,"16 people|no - just we will leave after the art portion":150,"16 people|yes - add 30 minutes":278,"16 people|yes - add 60 minutes":406,"17 people|no - just we will leave after the art portion":175,"17 people|yes - add 30 minutes":311,"17 people|yes - add 60 minutes":447,"18 people|no - just we will leave after the art portion":200,"18 people|yes - add 30 minutes":344,"18 people|yes - add 60 minutes":488,"19 people|no - just we will leave after the art portion":225,"19 people|yes - add 30 minutes":377,"19 people|yes - add 60 minutes":529,"20 people|no - just we will leave after the art portion":250,"20 people|yes - add 30 minutes":410,"20 people|yes - add 60 minutes":570,
  "21 people|no - just we will leave after the art portion":275,"21 people|yes - add 30 minutes":443,"21 people|yes - add 60 minutes":611,"22 people|no - just we will leave after the art portion":300,"22 people|yes - add 30 minutes":476,"22 people|yes - add 60 minutes":652,"23 people|no - just we will leave after the art portion":325,"23 people|yes - add 30 minutes":509,"23 people|yes - add 60 minutes":693,"24 people|no - just we will leave after the art portion":350,"24 people|yes - add 30 minutes":542,"24 people|yes - add 60 minutes":734,"25 people|no - just we will leave after the art portion":435,"25 people|yes - add 30 minutes":635,"25 people|yes - add 60 minutes":835,"26 people|no - just we will leave after the art portion":460,"26 people|yes - add 30 minutes":668,"26 people|yes - add 60 minutes":876,"27 people|no - just we will leave after the art portion":460,"27 people|yes - add 30 minutes":701,"27 people|yes - add 60 minutes":917,"28 people|no - just we will leave after the art portion":510,"28 people|yes - add 30 minutes":734,"28 people|yes - add 60 minutes":958,"29 people|no - just we will leave after the art portion":535,"29 people|yes - add 30 minutes":767,"29 people|yes - add 60 minutes":999,"30 people|no - just we will leave after the art portion":560,"30 people|yes - add 30 minutes":800,"30 people|yes - add 60 minutes":1040
}

function guestsToVariantKey(n, subtype) {
  if (subtype === 'adult') {
    if (n <= 10) return 'up to 10 people (base price)'
    return `${n} people`
  } else {
    // kids / splatter
    if (n <= 8) return 'up to 8 people (base price)'
    return `${n} people`
  }
}

function partyTimeToVariantKey(partyTimeVal, subtype) {
  if (!partyTimeVal || partyTimeVal === 'none' || partyTimeVal === '') {
    return subtype === 'adult'
      ? 'no - just we will leave after the art portion'
      : 'no - just we will leave after the art portion'
  }
  if (partyTimeVal === '30 min') {
    return subtype === 'adult' ? 'yes - add 30 minutes' : 'yes - add 30 minutes (enough time for cake only)'
  }
  if (partyTimeVal === '45 min') return 'yes - add 45 minutes (enough time for lunch/snacks and cake)'
  if (partyTimeVal === '60 min') return 'yes - add 60 minutes'
  return subtype === 'adult' ? 'no - just we will leave after the art portion' : 'no - just we will leave after the art portion'
}

function artTimeToVariantKey(artTimeVal) {
  if (artTimeVal === '90 min') return 'yes - 90 minutes of art time'
  return 'no - 60 minutes for the art project is good!'
}

function lookupAddonPrice(subtype, guestKey, partyTimeKey, artTimeKey, canvasKey, isMember) {
  let price = null
  if (subtype === 'kids' || subtype === 'splatter') {
    if (subtype === 'kids') {
      const key = `${artTimeKey}|${partyTimeKey}|${guestKey}`
      price = KIDS_PRICES[key] ?? null
    } else {
      const canvas = canvasKey || 'no - watercolour paper is fine'
      const key = `${partyTimeKey}|${guestKey}|${canvas}`
      price = SPLATTER_PRICES[key] ?? null
    }
    if (price !== null && isMember) price = Math.round(price * 0.65 * 100) / 100
  } else if (subtype === 'adult') {
    const key = `${guestKey}|${partyTimeKey}`
    price = ADULT_PRICES[key] ?? null
    // Member pricing for adult is different rates embedded in table — no blanket discount
    // Members pay $20/pp instead of $25/pp for extra guests, and $12.80/pp/hr instead of $16
    // Since Shopify tables use non-member prices, apply member discount to extra guest portion
    if (price !== null && isMember && price > 0) {
      // Rough member adjustment: ~80% for guest portion, ~80% for party time
      price = Math.round(price * 0.80 * 100) / 100
    }
  }
  return price
}

function calculatePartyOutcome(addonDetails, subtype, isMember, actualGuests, actualArtTime, actualPartyTime, projectUpgradePaid) {
  if (actualGuests === null || actualGuests === undefined) return null

  const taxRate = getTaxRate(currentStudioId)

  // What they PAID for (from add-on variant)
  const paidGuests = addonDetails.guestCount || (subtype === 'adult' || subtype === 'fieldtrip' ? 10 : 8)
  const paidArtTime = addonDetails.artTime || '60 min'
  const paidPartyTime = addonDetails.partyTime || 'none'
  const paidCanvasUpgrade = addonDetails.canvasUpgrade

  const paidGuestKey = guestsToVariantKey(paidGuests, subtype)
  const paidPartyKey = partyTimeToVariantKey(paidPartyTime, subtype)
  const paidArtKey = artTimeToVariantKey(paidArtTime)
  const paidCanvasKey = paidCanvasUpgrade ? 'yes please! ($6/pp)' : 'no - watercolour paper is fine'

  const paidAddonPrice = lookupAddonPrice(subtype, paidGuestKey, paidPartyKey, paidArtKey, paidCanvasKey, isMember) || 0
  // Adult teacher fee: $60 applies at 21+ guests, but only for 21-24 (25+ already baked into price table)
  const ADULT_TEACHER_FEE = 60
  const paidTeacherFee = (subtype === 'adult' && paidGuests >= 21 && paidGuests < 25) ? ADULT_TEACHER_FEE : 0
  const paidProjectUpgrade = projectUpgradePaid ? 20 : 0
  const totalPaid = paidAddonPrice + paidTeacherFee + paidProjectUpgrade

  // What ACTUALLY happened
  const actualGuestKey = guestsToVariantKey(actualGuests, subtype)
  const actualPartyKey = partyTimeToVariantKey(actualPartyTime, subtype)
  const actualArtKey = artTimeToVariantKey(actualArtTime)

  // No-show minimum rules
  let chargeableGuests = actualGuests
  let minimumApplied = false
  let minimumNote = null

  if (subtype === 'kids' || subtype === 'splatter') {
    if (paidGuests >= 16 && actualGuests < 16) {
      chargeableGuests = 16
      minimumApplied = true
      minimumNote = `Minimum 16 guests applies (booked ${paidGuests}, attended ${actualGuests})`
    }
  } else if (subtype === 'adult') {
    if (paidGuests >= 21 && actualGuests < 21) {
      chargeableGuests = 21
      minimumApplied = true
      minimumNote = `Minimum 21 guests applies (booked ${paidGuests}, attended ${actualGuests})`
    }
  }

  const actualChargeableGuestKey = guestsToVariantKey(chargeableGuests, subtype)
  const actualAddonPrice = lookupAddonPrice(subtype, actualChargeableGuestKey, actualPartyKey, actualArtKey, paidCanvasKey, isMember) || 0
  // Apply teacher fee to actual side too when chargeable guests is in the 21-24 range
  const actualTeacherFee = (subtype === 'adult' && chargeableGuests >= 21 && chargeableGuests < 25) ? ADULT_TEACHER_FEE : 0
  const totalActual = actualAddonPrice + actualTeacherFee + paidProjectUpgrade // project upgrade always kept

  const diff = totalPaid - totalActual // positive = credit owed, negative = charge owed
  const diffWithTax = Math.round(Math.abs(diff) * (1 + taxRate) * 100) / 100

  return {
    paidGuests, paidArtTime, paidPartyTime,
    actualGuests, actualArtTime: actualArtTime || '—', actualPartyTime: actualPartyTime || '—',
    chargeableGuests, minimumApplied, minimumNote,
    paidAddonPrice, paidTeacherFee, totalPaid,
    actualAddonPrice, actualTeacherFee, totalActual,
    diff, diffWithTax,
    taxRate, taxAmount: Math.round(Math.abs(diff) * taxRate * 100) / 100,
    isCredit: diff > 0,
    isCharge: diff < 0,
    isAllGood: diff === 0,
    isMember
  }
}

function renderOutcomeCalculator(calc, uid, booking, sessionTitle, sessionDate) {
  if (!calc) return ''

  const fmt = n => `$${Math.abs(n).toFixed(2)}`
  const studioName = document.getElementById('studio-name')?.textContent || ''

  let calcRows = `
    <div class="calc-row"><span class="calc-label">Paid add-on (${calc.paidGuests} guests · ${calc.paidArtTime} art · party: ${calc.paidPartyTime})</span><span class="calc-value">${fmt(calc.paidAddonPrice)}</span></div>
    ${calc.paidTeacherFee ? `<div class="calc-row"><span class="calc-label">Paid teacher fee (21–24 guests)</span><span class="calc-value">${fmt(calc.paidTeacherFee)}</span></div>` : ''}
    <div class="calc-row"><span class="calc-label">Actual (${calc.chargeableGuests} guests · ${calc.actualArtTime} art · party: ${calc.actualPartyTime})${calc.minimumApplied ? ' ⚠️' : ''}</span><span class="calc-value">${fmt(calc.actualAddonPrice)}</span></div>
    ${calc.actualTeacherFee ? `<div class="calc-row"><span class="calc-label">Teacher fee (21–24 guests, retained)</span><span class="calc-value">${fmt(calc.actualTeacherFee)}</span></div>` : ''}
    <div class="calc-row"><span class="calc-label">Difference (pre-tax)</span><span class="calc-value ${calc.isCredit ? 'credit' : calc.isCharge ? 'charge' : 'neutral'}">${calc.isCredit ? '−' : calc.isCharge ? '+' : ''}${fmt(calc.diff)}</span></div>
    <div class="calc-row"><span class="calc-label">Tax (${Math.round(calc.taxRate * 100)}%)</span><span class="calc-value">${fmt(calc.taxAmount)}</span></div>
    <div class="calc-row total"><span class="calc-label">${calc.isCredit ? 'Credit to issue' : calc.isCharge ? 'Charge on POS' : 'No adjustment needed'}</span><span class="calc-value ${calc.isCredit ? 'credit' : calc.isCharge ? 'charge' : 'neutral'}">${calc.isAllGood ? '✓ All good' : fmt(calc.diffWithTax)}</span></div>
  `
  if (calc.minimumNote) calcRows += `<div class="calc-minimum-note">⚠️ ${calc.minimumNote}</div>`

  let actionHtml = ''
  if (calc.isCredit && calc.diffWithTax > 0) {
    const encodedEmail = encodeURIComponent(booking.customer_email || '')
    const encodedName = encodeURIComponent(booking.customer_name || '')
    actionHtml = `
      <button class="gift-card-btn" id="gc-btn-${uid}" onclick="issueGiftCard('${uid}','${escText(booking.customer_email)}',${jsArg(booking.customer_name)},${calc.diffWithTax},${calc.taxRate},'${booking.shopify_order_name}','${sessionDate}',${jsArg(sessionTitle)})">
        🎁 Send $${calc.diffWithTax.toFixed(2)} Gift Card to ${escText(booking.customer_email)}
      </button>`
  } else if (calc.isCharge && calc.diffWithTax > 0) {
    actionHtml = `
      <div class="charge-info">
        <strong>💳 Charge on POS: $${calc.diffWithTax.toFixed(2)}</strong>
        ${calc.actualGuests > calc.paidGuests ? `${calc.actualGuests - calc.paidGuests} extra guest(s) × rate + tax` : 'Adjustment for actual usage'}
      </div>
      <div class="pos-order-row">
        <input type="text" id="pos-order-${uid}" placeholder="POS order # after charging..." value="">
        <button onclick="savePosOrder('${uid}')">Save order #</button>
      </div>`
  }

  return `<div class="outcome-calculator"><div class="calc-title">💰 Outcome Calculation${calc.isMember ? ' · Member pricing' : ''}</div>${calcRows}${actionHtml}</div>`
}

async function issueGiftCard(uid, email, name, amount, taxRate, orderName, sessionDate, sessionTitle) {
  const btn = document.getElementById(`gc-btn-${uid}`)
  if (!btn) return
  btn.textContent = '⏳ Sending gift card...'
  btn.disabled = true

  const studioName = document.getElementById('studio-name')?.textContent || ''

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/issue-party-gift-card`, {
      method: 'POST',
      headers: await fnHeaders(),   // signed-in login: the gift card function requires it
      body: JSON.stringify({
        customer_email: email,
        customer_name: name,
        amount_pretax: Math.round(amount / (1 + taxRate) * 100) / 100,
        tax_rate: taxRate,
        order_name: orderName,
        session_date: sessionDate,
        party_type: sessionTitle,
        studio_name: studioName,
      })
    })
    const data = await res.json()
    if (data.success) {
      btn.textContent = `✓ Gift card sent! (ends in ...${data.last_characters})`
      btn.style.background = '#2e7d32'
      btn.disabled = true
      // Save to party_details outcome
      const blockEl = btn.closest('[id^="block-"]')
      if (blockEl) {
        const uid2 = blockEl.id.replace('block-', '')
        const outcomeEl = document.getElementById(`${uid2}-outcome`)
        if (outcomeEl) { outcomeEl.value = 'Issue credit'; }
        const amountEl = document.getElementById(`${uid2}-outcome_amount`)
        if (amountEl) amountEl.value = data.amount
        const notesEl = document.getElementById(`${uid2}-outcome_notes`)
        if (notesEl) notesEl.value = `Gift card sent to ${email} (ends ...${data.last_characters}), expires ${data.expires_on}`
      }
    } else {
      btn.textContent = '❌ Error — try again'
      btn.disabled = false
      btn.style.background = '#99354e'
      console.error('Gift card error:', data)
      alert('Could not send gift card: ' + (data.error || 'Unknown error'))
    }
  } catch(e) {
    btn.textContent = '❌ Error — try again'
    btn.disabled = false
    btn.style.background = '#99354e'
    alert('Network error: ' + e.message)
  }
}

async function savePosOrder(uid) {
  const btn = document.querySelector(`#pos-order-${uid}`)?.nextElementSibling
  const val = document.getElementById(`pos-order-${uid}`)?.value?.trim()
  if (!val) return
  // Save to outcome_notes
  const notesEl = document.getElementById(`${uid}-outcome_notes`)
  if (notesEl) notesEl.value = `POS order: ${val}`
  const outcomeEl = document.getElementById(`${uid}-outcome`)
  if (outcomeEl) outcomeEl.value = 'Charge extra'
  if (btn) { btn.textContent = 'Saved ✓'; btn.classList.add('saved'); setTimeout(() => { btn.textContent = 'Save order #'; btn.classList.remove('saved') }, 2000) }
}

function getPartySubtype(sessionTitle) {
  const t = (sessionTitle || '').toLowerCase()
  if (t.includes('splatter')) return 'splatter'
  if (t.includes('adult get-together') || t.includes('adult get together')) return 'adult'
  if (t.includes('field trip')) return 'fieldtrip'
  return 'kids'
}

function getProjectTypeFromPayload(rawPayload) {
  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    if (!payload?.line_items) return null
    for (const li of payload.line_items) {
      const props = li.properties || []
      for (const p of props) {
        if ((p.name || '').toLowerCase().includes('project type') || (p.name || '').toLowerCase().includes('project')) {
          return p.value || null
        }
      }
    }
    return null
  } catch(e) { return null }
}

function mapProjectTypeToMedium(projectType) {
  if (!projectType) return null
  const v = projectType.toLowerCase().trim()
  if (v.includes('besties'))           return 'besties'
  if (v.includes('clay') && !v.includes('oven') && !v.includes('bake')) return 'clay'
  if (v.includes('oven') || v.includes('obc')) return 'obc'
  if (v.includes('paint'))             return 'painting'
  if (v.includes('splatter'))          return 'splatter'
  return null
}

function getSpecificProjectFromPayload(rawPayload) {
  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    if (!payload?.line_items) return null
    for (const li of payload.line_items) {
      const props = li.properties || []
      for (const p of props) {
        if ((p.name || '').toLowerCase().trim() === 'specific project') {
          return p.value || null
        }
      }
    }
    return null
  } catch(e) { return null }
}

function isMemberOrder(rawPayload) {
  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    return (payload?.discount_applications || []).length > 0
  } catch { return false }
}

function parsePartyAddons(rawPayload, subtype) {
  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    if (!payload?.line_items) return []
    const addons = []
    for (const li of payload.line_items) {
      const title = (li.title || li.name || '').trim()
      const variant = (li.variant_title || '').trim()
      // Skip the main party booking line item (has date prefix) and studio variant lines
      if (/^\d+(am|pm|\:\d)/i.test(title)) continue
      if (!title || title === variant) continue
      addons.push({ title, variant, qty: li.quantity || 1 })
    }
    return addons
  } catch(e) { return [] }
}

function parseAddonDetails(addons, subtype) {
  const result = {
    artTime: null,
    partyTime: null,
    guestCount: null,
    projectUpgrade: false,
    canvasUpgrade: false,
    parentHelperQty: null,
    raw: []
  }

  for (const addon of addons) {
    const title = addon.title.toLowerCase()
    const variant = addon.variant || ''
    result.raw.push({ title: addon.title, variant })

    if (title.includes('kids party extra guests') || title.includes('splatter party extra guests')) {
      // Format: "art time / party time / guests" (kids/splatter)
      const parts = variant.split(' / ')
      if (parts.length >= 1) {
        const p0 = parts[0].toLowerCase()
        if (p0.includes('yes') && p0.includes('90')) result.artTime = '90 min'
        else if (p0.includes('no') || p0.includes('60')) result.artTime = '60 min'
        // For splatter, segment 0 is party time
        if (subtype === 'splatter') {
          if (p0.includes('45')) result.partyTime = '45 min'
          else if (p0.includes('30')) result.partyTime = '30 min'
          else if (p0.includes('no')) result.partyTime = 'none'
        }
      }
      if (parts.length >= 2) {
        const p1 = parts[1].toLowerCase()
        if (subtype !== 'splatter') {
          if (p1.includes('45')) result.partyTime = '45 min'
          else if (p1.includes('30')) result.partyTime = '30 min'
          else if (p1.includes('no')) result.partyTime = 'none'
        } else {
          // Splatter segment 1 = guests
          const numMatch = p1.match(/(\d+)/)
          if (numMatch) result.guestCount = parseInt(numMatch[1])
          else if (p1.includes('up to 8') || p1.includes('base')) result.guestCount = 8
        }
      }
      if (parts.length >= 3) {
        const p2 = parts[2].toLowerCase()
        if (subtype !== 'splatter') {
          // Kids: segment 2 = guests
          const numMatch = p2.match(/(\d+)/)
          if (numMatch) result.guestCount = parseInt(numMatch[1])
          else if (p2.includes('up to 8') || p2.includes('base')) result.guestCount = 8
        } else {
          // Splatter: segment 2 = canvas upgrade
          if (p2.includes('yes')) result.canvasUpgrade = true
        }
      }
    } else if (title.includes('adult get-togethers extra guests') || title.includes('adult get togethers extra guests')) {
      // Format: "X people / party time"
      const parts = variant.split(' / ')
      if (parts.length >= 1) {
        const numMatch = parts[0].match(/(\d+)/)
        if (numMatch) result.guestCount = parseInt(numMatch[1])
      }
      if (parts.length >= 2) {
        const p1 = parts[1].toLowerCase()
        if (p1.includes('no')) result.partyTime = 'none'
        else if (p1.includes('60')) result.partyTime = '60 min'
        else if (p1.includes('30')) result.partyTime = '30 min'
        else result.partyTime = 'yes'
      }
    } else if (title.includes('project upgrade')) {
      result.projectUpgrade = variant.toLowerCase().includes('yes')
    } else if (title.includes('parent')) {
      result.parentHelperQty = (result.parentHelperQty || 0) + (addon.qty || 1)
    } else if (title.includes('extra guests') || title.includes('party add on')) {
      // Legacy/field trip add-ons — just show raw
    }
  }
  return result
}

function getPhoneFromPayload(rawPayload) {
  try {
    const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    return p?.billing_address?.phone
      || p?.shipping_address?.phone
      || p?.customer?.default_address?.phone
      || p?.customer?.phone
      || p?.phone
      || ''
  } catch { return '' }
}

function getOrderNoteFromPayload(rawPayload) {
  try {
    const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    return p?.note || ''
  } catch { return '' }
}

function getBillingName(rawPayload) {
  try {
    const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    return p?.billing_address?.name || p?.customer?.default_address?.name || ''
  } catch { return '' }
}

function buildAddonPills(addonDetails, subtype) {
  const pills = []
  if (addonDetails.artTime) pills.push(`<span class="addon-pill">🎨 Art: ${addonDetails.artTime}</span>`)
  if (addonDetails.partyTime && addonDetails.partyTime !== 'none') pills.push(`<span class="addon-pill">🎉 Extra time: ${addonDetails.partyTime}</span>`)
  if (addonDetails.guestCount) pills.push(`<span class="addon-pill">👥 ${addonDetails.guestCount} guests</span>`)
  if (addonDetails.projectUpgrade) pills.push(`<span class="addon-pill upgrade">⭐ Project upgrade (clay or painting)</span>`)
  else if (subtype === 'kids' && addonDetails.raw.some(a => a.title.toLowerCase().includes('extra guests'))) pills.push(`<span class="addon-pill">🏺 Oven-bake clay only</span>`)
  if (addonDetails.canvasUpgrade) pills.push(`<span class="addon-pill upgrade">🖼 Canvas upgrade (8×8)</span>`)
  if (addonDetails.parentHelperQty) pills.push(`<span class="addon-pill">👪 ${addonDetails.parentHelperQty} parent pass${addonDetails.parentHelperQty !== 1 ? 'es' : ''}</span>`)
  // Any other raw add-ons not captured above
  for (const r of addonDetails.raw) {
    const t = r.title.toLowerCase()
    if (!t.includes('extra guests') && !t.includes('project upgrade') && !t.includes('party add on')) {
      pills.push(`<span class="addon-pill">${escText(r.title)}${r.variant ? ': ' + r.variant : ''}</span>`)
    }
  }
  return pills.join('')
}

function buildPaidPill(addonDetails, subtype) {
  const hasAddon = addonDetails.raw && addonDetails.raw.length > 0
  const parts = []

  if (!hasAddon) {
    // No add-on purchased — show base only
    if (subtype === 'adult' || subtype === 'fieldtrip') parts.push('10 guests · 90 min art · no party time')
    else parts.push('8 guests · 60 min art · no party time')
    return `<span class="party-paid-pill" style="background:#f5f5f0;border-color:#d0d0c8;color:#888">📋 Paid: base only (${parts[0]})</span>`
  }

  // Has add-on — show what was purchased
  if (addonDetails.guestCount) parts.push(`${addonDetails.guestCount} guests`)
  else parts.push(subtype === 'adult' || subtype === 'fieldtrip' ? '10 guests (base)' : '8 guests (base)')
  if (subtype === 'kids' || subtype === 'splatter') parts.push(addonDetails.artTime || '60 min art')
  if (addonDetails.partyTime && addonDetails.partyTime !== 'none') parts.push(`${addonDetails.partyTime} party time`)
  else parts.push('no party time')
  if (addonDetails.canvasUpgrade) parts.push('canvas upgrade')
  if (addonDetails.projectUpgrade) parts.push('project upgrade')
  return `<span class="party-paid-pill">💳 Paid: ${parts.join(' · ')}</span>`
}

function buildPartyBookingBlock(booking, partyDetail, subtype, blockIdx, sessionTitle, sessionDate, sessionTime, sessionSignins, scope) {
  const uid = `${scope||''}pb-${booking.id.replace(/-/g,'').slice(0,8)}`
  const addons = parsePartyAddons(booking.raw_payload, subtype)
  const addonDetails = parseAddonDetails(addons, subtype)
  const phone = getPhoneFromPayload(booking.raw_payload)
  const billingName = getBillingName(booking.raw_payload)
  const orderNote = getOrderNoteFromPayload(booking.raw_payload)
  const showBillingName = billingName && billingName.toLowerCase() !== (booking.customer_name || '').toLowerCase()
  const addonPills = buildAddonPills(addonDetails, subtype)
  const pd = partyDetail || {}
  const linkedExtrasOrders = getLinkedExtrasOrders(booking.raw_payload)
  const isMember = isMemberOrder(booking.raw_payload)
  const projectTypeFromShopify = getProjectTypeFromPayload(booking.raw_payload)

  // Count of this customer's prior orders that actually produced a booking row
  // (membership-only orders don't count) — captured at the moment this order came in.
  // null = older booking from before we started tracking this.
  const bookingNumber = booking.customer_booking_number
  const orderCountBadge = bookingNumber == null ? '' :
    bookingNumber === 1
      ? `<span style="font-size:11px;color:#2e6b99;background:#e6f2fb;padding:3px 10px;border-radius:20px;white-space:nowrap">🆕 1st booking</span>`
      : bookingNumber === 2
        ? `<span style="font-size:11px;color:#8a6d00;background:#fff6de;padding:3px 10px;border-radius:20px;white-space:nowrap">2nd booking</span>`
        : `<span style="font-size:11px;color:#666;background:#f0f0f0;padding:3px 10px;border-radius:20px;white-space:nowrap">Booking #${bookingNumber}</span>`

  // Suggested expected guests from add-on, fall back to base
  const suggestedGuests = addonDetails.guestCount || (subtype === 'adult' || subtype === 'fieldtrip' ? 10 : 8)

  // Auto-fill after-party times from what was booked (if not yet saved)
  const defaultArtTime = (subtype === 'adult' || subtype === 'fieldtrip') ? '90 min' : '60 min'
  const autoArtTime = pd.actual_art_time || addonDetails.artTime || defaultArtTime
  const autoPartyTime = (pd.actual_party_time !== null && pd.actual_party_time !== undefined && pd.actual_party_time !== '')
    ? pd.actual_party_time
    : (addonDetails.partyTime || 'none')
  const artAutoFilled = !pd.actual_art_time   // true = pre-filled from booking, not saved
  const partyAutoFilled = !pd.actual_party_time

  // 11am slots get a parent passes field in the after-party section
  const is11am = (sessionTime || '').startsWith('11:')

  // Type-specific fields
  let typeSpecificFields = ''
  if (subtype === 'kids') {
    const autoMedium = pd.medium || mapProjectTypeToMedium(projectTypeFromShopify) || ''
    const specificProjectFromShopify = getSpecificProjectFromPayload(booking.raw_payload)
    const projectPrefillKids = pd.project || specificProjectFromShopify || ''
    const projectFromShopifyKids = !pd.project && specificProjectFromShopify
    const reasonPrefillKids = pd.party_reason || booking.reason_for_gathering || ''
    const reasonFromShopifyKids = !pd.party_reason && booking.reason_for_gathering
    typeSpecificFields = `
      <div class="field-group">
        <div class="field-label">Party Reason${reasonFromShopifyKids ? ' <span style="color:#c06080;font-weight:normal;font-size:10px">(from booking)</span>' : ''}</div>
        <input type="text" id="${uid}-party_reason" value="${reasonPrefillKids.replace(/"/g,'&quot;')}" placeholder="Birthday, celebration...">
      </div>
      <div class="field-group">
        <div class="field-label">Medium${projectTypeFromShopify ? ` <span style="color:#c06080;font-weight:normal">(Shopify: ${projectTypeFromShopify})</span>` : ''}</div>
        <select id="${uid}-medium">
          <option value="">— not set —</option>
          <option value="obc"      ${autoMedium==='obc'      ? 'selected':''}>🌈 Oven-bake Clay</option>
          <option value="clay"     ${autoMedium==='clay'     ? 'selected':''}>🏺 Clay</option>
          <option value="painting" ${autoMedium==='painting' ? 'selected':''}>🎨 Painting</option>
          <option value="besties"  ${autoMedium==='besties'  ? 'selected':''}>💕 Besties</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Project${projectFromShopifyKids ? ' <span style="color:#c06080;font-weight:normal;font-size:10px">(from booking)</span>' : ''}</div>
        <input type="text" id="${uid}-project" value="${projectPrefillKids.replace(/"/g,'&quot;')}" placeholder="What they're making...">
      </div>`
  } else if (subtype === 'splatter') {
    typeSpecificFields = `
      <div class="field-group">
        <div class="field-label">Party Reason</div>
        <input type="text" id="${uid}-party_reason" value="${(pd.party_reason||'').replace(/"/g,'&quot;')}" placeholder="Birthday, celebration...">
      </div>
      <div class="field-group">
        <div class="field-label">Colour Choice</div>
        <input type="text" id="${uid}-colour_choice" value="${(pd.colour_choice||'').replace(/"/g,'&quot;')}" placeholder="e.g. blues and greens...">
      </div>`
  } else if (subtype === 'adult') {
    const adultMedium = pd.medium || 'clay'
    const occasionPrefill = pd.occasion || booking.reason_for_gathering || ''
    const projectPrefill = pd.project || booking.project_preference || ''
    const occasionFromShopify = !pd.occasion && booking.reason_for_gathering
    const projectFromShopify = !pd.project && booking.project_preference
    typeSpecificFields = `
      <div class="field-group">
        <div class="field-label">Occasion${occasionFromShopify ? ' <span style="color:#c06080;font-weight:normal;font-size:10px">(from booking)</span>' : ''}</div>
        <input type="text" id="${uid}-occasion" value="${occasionPrefill.replace(/"/g,'&quot;')}" placeholder="Bachelorette, birthday, team event...">
      </div>
      <div class="field-group">
        <div class="field-label">Medium</div>
        <select id="${uid}-medium">
          <option value="clay"     ${adultMedium==='clay'     ? 'selected':''}>🏺 Clay</option>
          <option value="obc"      ${adultMedium==='obc'      ? 'selected':''}>🌈 Oven-bake Clay</option>
          <option value="painting" ${adultMedium==='painting' ? 'selected':''}>🎨 Painting</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Project Choice${projectFromShopify ? ' <span style="color:#c06080;font-weight:normal;font-size:10px">(from booking)</span>' : ''}</div>
        <input type="text" id="${uid}-project" value="${projectPrefill.replace(/"/g,'&quot;')}" placeholder="What they're making...">
      </div>`
  } else if (subtype === 'fieldtrip') {
    const ftMedium = pd.medium || 'obc'
    typeSpecificFields = `
      <div class="field-group">
        <div class="field-label">School / Organization</div>
        <input type="text" id="${uid}-school_name" value="${(pd.school_name||'').replace(/"/g,'&quot;')}" placeholder="School name...">
      </div>
      <div class="field-group">
        <div class="field-label">Medium</div>
        <select id="${uid}-medium">
          <option value="clay"     ${ftMedium==='clay'     ? 'selected':''}>🏺 Clay</option>
          <option value="obc"      ${ftMedium==='obc'      ? 'selected':''}>🌈 Oven-bake Clay</option>
          <option value="painting" ${ftMedium==='painting' ? 'selected':''}>🎨 Painting</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Grade / Age Group</div>
        <input type="text" id="${uid}-grade_age_group" value="${(pd.grade_age_group||'').replace(/"/g,'&quot;')}" placeholder="e.g. Grade 3, ages 7–9">
      </div>`
  }

  const outcomeVal = pd.outcome || ''

  return `
  <div class="party-booking-block${pd.actual_guests ? ' party-closed' : ''}" id="block-${uid}">
    <div class="party-booking-header">
      <div>
        <div class="party-booking-name">${escText(booking.customer_name || 'Unknown customer')}${showBillingName ? ` <span style="font-weight:400;color:#c06080">(${billingName})</span>` : ''}</div>
        <div class="party-booking-meta">
          ${escText(booking.customer_email || '')}${phone ? ' · ' + phone : ''}
          · ${booking.shopify_order_name ? shopifyOrderLink(booking.shopify_order_name) : '—'}${linkedExtrasOrders.length ? ' · Extras: ' + linkedExtrasOrders.map(shopifyOrderLink).join(', ') : ''}
        </div>
        ${orderNote ? `<div style="font-size:12px;color:#7a4060;background:#fce8f0;border-radius:6px;padding:4px 10px;margin-top:6px">📝 ${orderNote}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span style="font-size:11px;color:#c06080;background:#fce8f0;padding:3px 10px;border-radius:20px">Booking ${blockIdx + 1}</span>
        <span id="${uid}-closed-badge" style="font-size:11px;color:#2e7d32;background:#e8f5e9;padding:3px 10px;border-radius:20px;white-space:nowrap;${pd.actual_guests ? '' : 'display:none'}">✓ Closed</span>
        ${orderCountBadge}
      </div>
    </div>

    ${addonPills ? `<div class="party-addon-pills">${addonPills}</div>` : ''}
    ${buildPaidPill(addonDetails, subtype)}

    <div class="party-section-label">📋 Planning</div>
    <div class="party-fields">
      <div class="field-group">
        <div class="field-label">Contact Name</div>
        <input type="text" id="${uid}-contact_name" value="${(pd.contact_name||booking.customer_name||'').replace(/"/g,'&quot;')}" placeholder="Name of contact...">
      </div>
      <div class="field-group">
        <div class="field-label">Contacted?</div>
        <select id="${uid}-contacted">
          <option value="" ${!pd.contacted?'selected':''}>—</option>
          <option value="Yes" ${pd.contacted==='Yes'?'selected':''}>Yes</option>
          <option value="No" ${pd.contacted==='No'?'selected':''}>No</option>
          <option value="Left message" ${pd.contacted==='Left message'?'selected':''}>Left message</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Expected Guests</div>
        <input type="number" id="${uid}-expected_guests" value="${pd.expected_guests || suggestedGuests}" min="1" max="100">
      </div>
      <div class="field-group">
        <div class="field-label">Additional Charges Planned</div>
        <input type="text" id="${uid}-additional_charges_planned" value="${(pd.additional_charges_planned||'').replace(/"/g,'&quot;')}" placeholder="e.g. 3 extra guests, extended time...">
      </div>
      ${typeSpecificFields}
      <div class="field-group full">
        <div class="field-label">Special Notes</div>
        <textarea id="${uid}-notes" placeholder="Allergies, special requests...">${escText(pd.notes||'')}</textarea>
      </div>
    </div>

    <div class="party-section-label">✅ After the Party</div>
    <div class="party-after-section">
      <div class="party-fields">
        <div class="field-group">
          <div class="field-label">Actual Guests</div>
          <input type="number" id="${uid}-actual_guests" value="${pd.actual_guests||''}" min="0" max="100" placeholder="How many showed up" oninput="recalcOutcome('${uid}','${subtype}')">
        </div>
        <div class="field-group">
          <div class="field-label">Actual Art Time${artAutoFilled ? ' <span style="font-size:9px;color:#b06080;font-weight:400;font-style:italic">(from booking)</span>' : ''}</div>
          <select id="${uid}-actual_art_time" onchange="recalcOutcome('${uid}','${subtype}')">
            <option value="" ${autoArtTime===''?'selected':''}>—</option>
            <option value="60 min" ${autoArtTime==='60 min'?'selected':''}>60 min</option>
            <option value="90 min" ${autoArtTime==='90 min'?'selected':''}>90 min</option>
          </select>
        </div>
        <div class="field-group">
          <div class="field-label">Actual Party Time${partyAutoFilled ? ' <span style="font-size:9px;color:#b06080;font-weight:400;font-style:italic">(from booking)</span>' : ''}</div>
          <select id="${uid}-actual_party_time" onchange="recalcOutcome('${uid}','${subtype}')">
            <option value="" ${autoPartyTime===''?'selected':''}>—</option>
            <option value="none" ${autoPartyTime==='none'?'selected':''}>None</option>
            <option value="30 min" ${autoPartyTime==='30 min'?'selected':''}>30 min</option>
            <option value="45 min" ${autoPartyTime==='45 min'?'selected':''}>45 min</option>
            <option value="60 min" ${autoPartyTime==='60 min'?'selected':''}>60 min</option>
          </select>
        </div>
        <div class="field-group">
          <div class="field-label">Outcome Notes</div>
          <input type="text" id="${uid}-outcome_notes" value="${(pd.outcome_notes||'').replace(/"/g,'&quot;')}" placeholder="Additional notes...">
        </div>
        ${is11am ? `
        <div class="field-group">
          <div class="field-label">👪 Parent Passes Used</div>
          <input type="number" id="${uid}-actual_parent_passes" value="${pd.actual_parent_passes||''}" min="0" max="50" placeholder="# who showed up">
        </div>` : ''}
      </div>
      <div id="${uid}-calc-area">
        ${pd.actual_guests ? `<div style="font-size:12px;color:#888;padding:8px 0">Save first to see calculation, or change values above.</div>` : '<div style="font-size:12px;color:#aaa;padding:8px 0">Enter actual guests and times above to see credit/charge calculation.</div>'}
      </div>
      <div style="display:none" id="${uid}-stored-addons" data-addons="${JSON.stringify(addonDetails).replace(/"/g,'&quot;')}" data-member="${isMember}" data-upgrade="${addonDetails.projectUpgrade}"></div>
    </div>

    <button class="party-save-btn no-print" onclick="savePartyDetail('${booking.id}','${booking.session_id}','${uid}','${subtype}',${jsArg((booking.customer_email||''))},${jsArg((booking.customer_name||''))},'${booking.shopify_order_name||''}',${jsArg(sessionTitle)},'${sessionDate||''}')">Save</button>
    ${booking.customer_email ? `<button class="party-email-btn no-print${pd.thank_you_sent_at ? ' sent' : ''}" id="${uid}-email-btn" onclick="sendPartyThankYou('${booking.id}','${uid}','${subtype}',${jsArg((booking.customer_email||''))},${jsArg((booking.customer_name||''))},${jsArg((sessionTitle||''))},'${sessionDate||''}')">` + (pd.thank_you_sent_at ? '✉️ Resend Thank You' : '✉️ Send Thank You') + `</button>` : ''}
    <div style="clear:both"></div>
    ${pd.thank_you_sent_at ? `<div class="party-ticket-display" id="${uid}-ticket-display">✉️ Thank you sent · ${pd.party_ticket_number || 'ticket assigned'}</div>` : `<div class="party-ticket-display" id="${uid}-ticket-display" style="display:none"></div>`}
    ${(() => {
      const allSignins = sessionSignins || []
      // Count entries matching this booking_id, OR (no booking_id on entry = legacy)
      const count = allSignins.filter(e => e.mode === 'party' && (e.booking_id === booking.id || !e.booking_id)).length
      return count > 0
        ? `<div style="margin-top:10px;border-top:0.5px solid #f0b8cc;padding-top:10px"><button onclick="showSignins('${booking.session_id}',${jsArg(sessionTitle)},'${booking.id}')" style="padding:7px 18px;background:#fff0f5;border:0.5px solid #f0b8cc;border-radius:8px;font-size:13px;color:#99354e;font-weight:600;cursor:pointer">✅ Checked In (${count})</button></div>`
        : ''
    })()}
  </div>`
}

function recalcOutcome(uid, subtype) {
  const actualGuests = parseInt(document.getElementById(`${uid}-actual_guests`)?.value)
  const actualArtTime = document.getElementById(`${uid}-actual_art_time`)?.value || ''
  const actualPartyTime = document.getElementById(`${uid}-actual_party_time`)?.value || ''
  const calcArea = document.getElementById(`${uid}-calc-area`)
  if (!calcArea) return

  if (!actualGuests) {
    calcArea.innerHTML = '<div style="font-size:12px;color:#aaa;padding:8px 0">Enter actual guests and times above to see credit/charge calculation.</div>'
    return
  }

  const storedEl = document.getElementById(`${uid}-stored-addons`)
  if (!storedEl) return
  let addonDetails
  try { addonDetails = JSON.parse(storedEl.getAttribute('data-addons').replace(/&quot;/g,'"')) } catch { return }
  const isMember = storedEl.getAttribute('data-member') === 'true'
  const projectUpgradePaid = storedEl.getAttribute('data-upgrade') === 'true'

  const calc = calculatePartyOutcome(addonDetails, subtype, isMember, actualGuests, actualArtTime, actualPartyTime, projectUpgradePaid)
  const blockEl = document.getElementById(`block-${uid}`)
  // Extract customer info from the block header
  const metaText = blockEl?.querySelector('.party-booking-meta')?.textContent || ''
  const metaParts = metaText.split('·').map(s => s.trim())
  const customerEmail = metaParts[0] || ''
  // Hub fix: the form shows the order as "#4011" (the Day view looked for "Order 4011", so it was always blank)
  const orderName = (metaParts.find(p => /^#\d/.test(p)) || metaParts.find(p => p.startsWith('Order '))?.replace('Order ','') || '').split(/\s/)[0]
  const customerName = blockEl?.querySelector('.party-booking-name')?.textContent?.split('(')[0]?.trim() || ''
  // Get session info from nearest session card
  const sessionCard = blockEl?.closest('[id^="card-"]')
  const sessionTitleEl = sessionCard?.querySelector('.session-title')
  const sessionTitle = sessionTitleEl?.textContent || ''
  const sessionDateVal = document.getElementById('date-picker')?.value || ''
  const fakeBooking = { customer_email: customerEmail, customer_name: customerName, shopify_order_name: orderName }
  calcArea.innerHTML = renderOutcomeCalculator(calc, uid, fakeBooking, sessionTitle, sessionDateVal)
}

async function savePartyDetail(bookingId, sessionId, uid, subtype, customerEmail, customerName, orderName, sessionTitle, sessionDate) {
  const btn = document.querySelector(`#block-${uid} .party-save-btn`)
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true }

  const val = id => document.getElementById(`${uid}-${id}`)?.value || null
  const numVal = id => { const v = document.getElementById(`${uid}-${id}`)?.value; return v ? parseInt(v) : null }

  // Auto-calculate outcome from actual vs paid
  const storedEl = document.getElementById(`${uid}-stored-addons`)
  let autoOutcome = null, autoAmount = null
  if (storedEl) {
    try {
      const addonDetails = JSON.parse(storedEl.getAttribute('data-addons').replace(/&quot;/g,'"'))
      const isMember = storedEl.getAttribute('data-member') === 'true'
      const projectUpgradePaid = storedEl.getAttribute('data-upgrade') === 'true'
      const actualGuests = numVal('actual_guests')
      const actualArtTime = val('actual_art_time')
      const actualPartyTime = val('actual_party_time')
      if (actualGuests) {
        const calc = calculatePartyOutcome(addonDetails, subtype, isMember, actualGuests, actualArtTime, actualPartyTime, projectUpgradePaid)
        if (calc) {
          autoAmount = calc.diffWithTax > 0 ? calc.diffWithTax.toFixed(2) : null
          if (calc.isAllGood) autoOutcome = 'All good'
          else if (calc.isCredit) autoOutcome = 'Issue credit'
          else if (calc.isCharge) autoOutcome = 'Charge extra'
        }
      }
    } catch(e) { console.warn('Could not calculate outcome', e) }
  }

  const payload = {
    booking_id: bookingId,
    session_id: sessionId,
    studio_id: currentStudioId,
    contact_name: val('contact_name'),
    contacted: val('contacted'),
    expected_guests: numVal('expected_guests'),
    additional_charges_planned: val('additional_charges_planned'),
    notes: val('notes'),
    actual_guests: numVal('actual_guests'),
    actual_art_time: val('actual_art_time'),
    actual_party_time: val('actual_party_time'),
    outcome: autoOutcome || null,
    outcome_amount: autoAmount,
    outcome_notes: val('outcome_notes'),
    party_teacher1: document.getElementById('d2-pt1-' + bookingId)?.value || null,
    party_teacher2: document.getElementById('d2-pt2-' + bookingId)?.value || null,
    updated_at: new Date().toISOString()
  }

  // Only include parent passes if the field exists (11am slots only)
  const parentPassesEl = document.getElementById(`${uid}-actual_parent_passes`)
  if (parentPassesEl) payload.actual_parent_passes = parseInt(parentPassesEl.value) || null

  if (subtype === 'kids') {
    payload.party_reason = val('party_reason')
    payload.project = val('project')
    payload.medium = val('medium') || null
  } else if (subtype === 'splatter') {
    payload.party_reason = val('party_reason')
    payload.colour_choice = val('colour_choice')
  } else if (subtype === 'adult') {
    payload.occasion = val('occasion')
    payload.project = val('project')
    payload.medium = val('medium') || null
  } else if (subtype === 'fieldtrip') {
    payload.school_name = val('school_name')
    payload.grade_age_group = val('grade_age_group')
    payload.medium = val('medium') || null
  }

  const { data: existing } = await sb.from('party_details')
    .select('id').eq('booking_id', bookingId).single()

  let error
  if (existing) {
    ;({ error } = await sb.from('party_details').update(payload).eq('booking_id', bookingId))
  } else {
    ;({ error } = await sb.from('party_details').insert(payload))
  }

  if (error) { alert('Error saving: ' + error.message); if (btn) { btn.textContent = 'Save'; btn.disabled = false }; return }
  if (btn) {
    btn.textContent = 'Saved ✓'
    btn.classList.add('saved')
    setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved'); btn.disabled = false }, 2000)
  }

  // Apply closed state if after-party data is now filled
  const actualGuestsNow = numVal('actual_guests')
  if (actualGuestsNow) {
    const blockEl = document.getElementById(`block-${uid}`)
    if (blockEl) blockEl.classList.add('party-closed')
    const badge = document.getElementById(`${uid}-closed-badge`)
    if (badge) badge.style.display = ''
  }

  // Auto-resolve any pending party-form task for this booking
  try {
    const { data: partyTask } = await sb.from('studio_tasks')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .maybeSingle()
    if (partyTask) {
      await sb.from('studio_tasks').update({
        status: 'complete',
        completed_at: new Date().toISOString()
      }).eq('id', partyTask.id)
      loadPartyFormBanner()
    }
  } catch(e) { /* non-critical */ }
}

async function sendPartyThankYou(bookingId, uid, subtype, customerEmail, customerName, sessionTitle, sessionDate) {
  const btn = document.getElementById(`${uid}-email-btn`)
  const ticketDisplay = document.getElementById(`${uid}-ticket-display`)
  if (btn) { btn.textContent = 'Sending...'; btn.disabled = true }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-party-thankyou`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ bookingId, customerEmail, customerName, studioId: currentStudioId, sessionTitle, sessionDate, subtype })
    })
    const result = await res.json()
    if (!result.success) throw new Error(result.error || 'Unknown error')

    if (btn) {
      btn.textContent = '✉️ Resend Thank You'
      btn.classList.add('sent')
      btn.disabled = false
    }
    if (ticketDisplay) {
      ticketDisplay.textContent = `✉️ Thank you sent · Ticket ${result.ticketNumber}`
      ticketDisplay.style.display = ''
    }
  } catch(e) {
    alert('Error sending thank-you email: ' + e.message)
    if (btn) { btn.textContent = '✉️ Send Thank You'; btn.disabled = false }
  }
}

function getLinkedExtrasOrders(rawPayload) {
  try {
    var p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    var items = (p && p.line_items) || []
    var out = []
    for (var i = 0; i < items.length; i++) {
      var o = items[i] && items[i]._linked_from_order
      if (o && out.indexOf(o) === -1) out.push(o)
    }
    return out
  } catch (e) { return [] }
}

function shopifyOrderLink(orderName) {
  if (!orderName) return '&mdash;'
  const encoded = encodeURIComponent(orderName)
  const url = `https://admin.shopify.com/store/4cats-arts-studio-main-street/orders?query=${encoded}`
  return `<a href="${url}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;border-bottom:1px dotted currentColor">${orderName}</a>`
}

// ── Kids class table, copied as-is from index.html (buildSeriesTable and its
//    save / attendance / sort helpers). Hub changes: customer-typed notes and
//    catch-up names are escaped; catch-up buttons are hidden by CSS for now.
function isSeriesClass2Plus(title) {
  return /\bclass\s+([2-9]|\d{2,})\s+of\s+\d+/i.test(title)
}

function isSeriesClass1(title) {
  return !isSeriesClass2Plus(title) && /\|\s*\d+\s*week\s*session/i.test(title || '')
}

function getSeriesTotalWeeks(title) {
  const m = (title || '').match(/(\d+)\s*week\s*session/i)
  return m ? m[1] : null
}

function getSeriesDisplayTitle(title) {
  if (isSeriesClass1(title)) {
    const weeks = getSeriesTotalWeeks(title)
    if (weeks) return title.replace(/\|\s*\d+\s*week\s*session/i, `| Class 1 of ${weeks}`)
  }
  return title
}

function catchupKey(bookingId, camperName) {
  return `${bookingId}|${(camperName || '').toLowerCase().trim()}`
}

async function fetchCatchupsOriginatingHere(sessionId) {
  const { data } = await sb.from('class_catchups')
    .select('id, origin_booking_id, camper_name, note, target_session_id, sessions!class_catchups_target_session_id_fkey(title, session_time, session_date)')
    .eq('origin_session_id', sessionId)
  const map = {}
  ;(data || []).forEach(c => { map[catchupKey(c.origin_booking_id, c.camper_name)] = c })
  return map
}

async function fetchCatchupsArrivingHere(sessionId) {
  const { data } = await sb.from('class_catchups')
    .select('id, camper_name, note, origin_session_id, origin_booking_id, created_at, sessions!class_catchups_origin_session_id_fkey(title, session_time, session_date)')
    .eq('target_session_id', sessionId)
    .order('created_at')
  return data || []
}

function catchupTargetLabel(row) {
  const s = row.sessions
  if (!s) return 'another class'
  const d = s.session_date ? new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''
  return `${getSeriesDisplayTitle(s.title)} · ${fmtTime(s.session_time)}${d ? ' ' + d : ''}`
}

function buildCatchupIncomingRows(incoming) {
  if (!incoming.length) return ''
  const rows = incoming.map(c => `<tr style="background:#f0f7ff">
    <td></td>
    <td><strong>${c.camper_name ? escText(c.camper_name) : '&mdash;'}</strong> <span style="font-size:10px;color:#2d6a9f;background:#e0edfc;padding:1px 6px;border-radius:8px">catch-up</span></td>
    <td colspan="6" style="font-size:12px;color:#666">from ${catchupTargetLabel(c)}${c.note ? ' — ' + c.note : ''}</td>
    <td style="text-align:center">1</td><td style="color:#888">&mdash;</td><td class="note-cell"></td>
    <td class="no-print"><button onclick="removeCatchupTransfer('${c.id}')" style="padding:4px 10px;background:none;border:0.5px solid #e0d0d0;border-radius:6px;font-size:11px;color:#c0392b;cursor:pointer">Remove</button></td>
  </tr>`).join('')
  return rows
}

function parseLineItemProperties(rawPayload, sessionDate) {
  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    if (!payload?.line_items) return []
    const items = payload.line_items
    let match = items.find(li => {
      const t = (li.title || li.name || '').toLowerCase()
      if (sessionDate) {
        const d = new Date(sessionDate + 'T12:00:00')
        const monthDay = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).replace('.', '').toLowerCase()
        if (t.includes(monthDay)) return true
        const day = d.getDate()
        const suffix = day===1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th'
        if (t.includes(`${monthDay}${suffix}`)) return true
      }
      return false
    })
    if (!match) match = items[0]
    return match?.properties || []
  } catch(e) { return [] }
}

function formatDOB(dobStr, refDateStr) {
  try {
    const dob = new Date(dobStr + 'T12:00:00')
    const ref = refDateStr ? new Date(refDateStr + 'T12:00:00') : new Date()
    let age = ref.getFullYear() - dob.getFullYear()
    const m = ref.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--
    const formatted = dob.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
    return `Age ${age} · b. ${formatted}`
  } catch(e) { return dobStr }
}

function getPayloadPhone(rawPayload) {
  try {
    const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    return p?.billing_address?.phone || p?.shipping_address?.phone || p?.customer?.phone || p?.phone || ''
  } catch { return '' }
}

function editInput(id, value, placeholder, cls) {
  return `<input type="text" class="edit-input${cls ? ' ' + cls : ''}" id="${id}" value="${(value || '').replace(/"/g,'&quot;')}" placeholder="${placeholder || ''}">`
}

function editCheck(id, checked) {
  return `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>`
}

function ordinalSuffix(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function bookingCountBadge(b) {
  const n = b.customer_booking_number
  if (n == null) return ''
  const label = n === 1 ? '🆕 1st' : `${n}${ordinalSuffix(n)}`
  const bg = n === 1 ? '#e6f2fb' : '#f0f0f0'
  const fg = n === 1 ? '#2e6b99' : '#888'
  return ` <span style="font-size:10px;color:${fg};background:${bg};padding:1px 6px;border-radius:8px;white-space:nowrap">${label}</span>`
}

let seriesTableRows = []

let seriesTableSort = { col: null, dir: 1 }

function sortSeriesTable(col) {
  if (seriesTableSort.col === col) seriesTableSort.dir *= -1
  else { seriesTableSort.col = col; seriesTableSort.dir = 1 }
  const sorted = [...seriesTableRows].sort((a,b) => (a[col]||'').toLowerCase().localeCompare((b[col]||'').toLowerCase()) * seriesTableSort.dir)
  document.getElementById('series-table-body').innerHTML = sorted.map(r => r.html).join('')
  document.querySelectorAll('.series-sort-btn').forEach(btn => {
    const isActive = btn.dataset.col === col
    btn.textContent = isActive ? (seriesTableSort.dir === 1 ? ' ↑' : ' ↓') : ' ⇅'
    btn.style.opacity = isActive ? '1' : '0.3'
  })
}

function buildSeriesTable(bookings, tallyData, attendanceData, sessionId, dateLabel, studioId, sessionTime, childrenData = {}, catchupOriginMap = {}, incomingCatchups = [], sessionTitle = '') {
  seriesTableRows = []
  seriesTableSort = { col: null, dir: 1 }

  function catchupControl(bookingId, camperName) {
    const wk = (window._wkMap || {})[bookingId]
    if (wk) return { rowStyle: wk.dir === 'out' ? 'opacity:0.6;background:#f6f6f6" class="wk-away' : '',   // (away this week: greyed and crossed out)
      html: `<div style="font-size:11px;color:${wk.dir === 'out' ? '#b91c1c' : '#1d4ed8'};margin-top:4px;white-space:normal">${wk.dir === 'out' ? '🚫' : '↪'} ${esc(wk.text)}</div>` +
        `<button onclick="hubWeekUndo('${bookingId}')" style="margin-top:4px;padding:3px 8px;background:#fff;border:0.5px solid #d1d5db;border-radius:6px;font-size:11px;cursor:pointer">Undo</button>` }
    const cu = catchupOriginMap[catchupKey(bookingId, camperName)]
    if (cu) {
      return { rowStyle: 'opacity:0.55;background:#fff8ec', html: `<div style="font-size:11px;color:#b06a00;margin-top:4px;white-space:normal">will be absent — joining ${catchupTargetLabel(cu)}${cu.note ? ' (' + cu.note + ')' : ''} <button onclick="removeCatchupTransfer('${cu.id}')" style="margin-left:4px;padding:1px 6px;background:none;border:0.5px solid #e0c8a0;border-radius:5px;font-size:10px;color:#b06a00;cursor:pointer">✕</button></div>` }
    }
    return { rowStyle: '', html: `<button onclick="openWeekModal('${bookingId}',${jsArg((camperName||''))})" style="margin-top:4px;padding:3px 8px;background:#f0f6ff;border:0.5px solid #c5d8f0;border-radius:6px;font-size:11px;color:#2d6a9f;cursor:pointer;white-space:nowrap">Can’t make it?</button>` }
  }

  bookings.forEach(b => {
    const note = getOrderNote(b)
    const orderUid = (b.shopify_order_name||'').replace('#','') || Math.random().toString(36).slice(2)
    const isCancelled = (b.qty || 0) === 0
    const cancelStyle = isCancelled ? ' style="opacity:0.4;text-decoration:line-through;color:#888"' : ''
    const props = parseLineItemProperties(b.raw_payload, b.event_date)
    let participants = props.filter(p => p.name?.toLowerCase().startsWith('participant')).sort((a,z)=>a.name.localeCompare(z.name)).map(p => {
      const name = p.value.split('|')[0]?.trim() || p.value
      const dobMatch = p.value.match(/DOB:\s*(\d{4}-\d{2}-\d{2})/)
      const dob = dobMatch ? dobMatch[1] : null
      const tally = (tallyData[b.shopify_order_name]||[]).find(t=>t.camper_name?.toLowerCase().trim()===name.toLowerCase().trim())
      return { name, dob, tally, source: 'shopify' }
    })
    if (participants.length === 0) {
      const tallyRows = (tallyData[b.shopify_order_name]||[]).filter((t,idx,arr)=>arr.findIndex(x=>x.camper_name?.toLowerCase().trim()===t.camper_name?.toLowerCase().trim())===idx)
      participants = tallyRows.map(t => ({ name: t.camper_name, dob: null, age: t.camper_age, tally: t, source: 'tally' }))
    }
    if (participants.length === 0) {
      const uid = orderUid
      const attKey = `${b.shopify_order_name}|`
      const att = attendanceData[attKey]
      const cu0 = catchupControl(b.id, '')
      seriesTableRows.push({ name:'', age:'', registeredBy: b.customer_name||'', html: `<tr${cancelStyle || (cu0.rowStyle ? ` style="${cu0.rowStyle}"` : '')}>
        <td style="text-align:center"><input type="checkbox" class="attended-check" ${att?.attended?'checked':''} onchange="saveAttendance('${sessionId}','${b.shopify_order_name}','',this.checked)"></td>
        <td>${editInput('scn-'+uid,'','Child name')}</td><td>${editInput('sca-'+uid,'','Age','short')}</td>
        <td>${editCheck('swh-'+uid,false)}</td><td>${editInput('smn-'+uid,'','Medical notes')}</td>
        <td>${editInput('spp-'+uid,b.customer_phone||getPayloadPhone(b.raw_payload),'Phone')}</td>
        <td>${editInput('sec-'+uid,'','Emergency contact')}</td>
        <td style="color:#888">${escText(b.customer_name) || '&mdash;'}${bookingCountBadge(b)}</td><td style="text-align:center">${b.qty}</td>
        <td style="color:#888">${shopifyOrderLink(b.shopify_order_name)}</td><td class="note-cell">${escText(note||'')}</td>
        <td class="no-print"><button class="row-save-btn" onclick="saveSeriesRow(null,'${b.shopify_order_name}','${uid}','${sessionId}','${studioId}','${sessionTime}')">Save</button>${cu0.html}</td>
      </tr>` })
      return
    }
    participants.forEach((p,i) => {
      const t = p.tally
      const uid = `${orderUid}-${i}`
      const camperName = p.name||''
      const attKey = `${b.shopify_order_name}|${camperName.toLowerCase().trim()}`
      const att = attendanceData[attKey]
      const ageDisplay = p.dob ? formatDOB(p.dob, dateLabel) : (p.age ? `Age ${p.age}` : '')
      const ageSortVal = p.dob ? p.dob : (p.age ? String(p.age).padStart(3,'0') : '')
      const cuP = catchupControl(b.id, camperName)
      seriesTableRows.push({ name: camperName, age: ageSortVal, registeredBy: i===0?(b.customer_name||''):'', html: `<tr${cancelStyle || (cuP.rowStyle ? ` style="${cuP.rowStyle}"` : '')}>
        <td style="text-align:center"><input type="checkbox" class="attended-check" ${att?.attended?'checked':''} onchange="saveAttendance('${sessionId}','${b.shopify_order_name}',${jsArg(camperName)},this.checked)"></td>
        <td>${editInput('scn-'+uid,camperName,'Child name')}</td><td style="font-size:12px;color:#666">${ageDisplay}</td>
        <td>${editCheck('swh-'+uid,t?.walk_home||false)}</td><td>${editInput('smn-'+uid,t?.medical_notes||'','Medical notes')}</td>
        <td>${editInput('spp-'+uid,t?.parent_phone||b.customer_phone||getPayloadPhone(b.raw_payload)||'','Phone')}</td>
        <td>${editInput('sec-'+uid,t?(t.emergency_contact_name||'')+(t.emergency_contact_phone?' '+t.emergency_contact_phone:''):'','Emergency contact')}</td>
        <td style="color:#888">${i===0?(b.customer_name||'&mdash;')+bookingCountBadge(b):''}</td><td style="text-align:center">1</td>
        <td style="color:#888">${shopifyOrderLink(b.shopify_order_name)}</td><td class="note-cell">${i===0?escText(note||''):''}</td>
        <td class="no-print"><button class="row-save-btn" onclick="saveSeriesRow('${t?.id||null}','${b.shopify_order_name}','${uid}','${sessionId}','${studioId}','${sessionTime}')">Save</button>${cuP.html}</td>
      </tr>` })
    })
    const existingChildren = childrenData[b.id] || []
    const extraCount = Math.max(0, (b.qty||1) - participants.length)
    for (let i = 0; i < extraCount; i++) {
      const childIndex = participants.length + i + 1
      const existing = existingChildren.find(c => c.child_index === childIndex)
      const cid = `${b.id}-child-${childIndex}`
      const attKey = `${b.shopify_order_name}|${(existing?.child_name||'').toLowerCase().trim()}`
      const att = existing?.child_name ? attendanceData[attKey] : null
      const cuC = catchupControl(b.id, existing?.child_name || '')
      seriesTableRows.push({ name: existing?.child_name||'', age: existing?.child_age||'', registeredBy: b.customer_name||'', html: `<tr style="background:#fafaf8${isCancelled ? ';opacity:0.4;text-decoration:line-through;color:#888' : (cuC.rowStyle ? ';'+cuC.rowStyle : '')}">
        <td style="text-align:center"><input type="checkbox" class="attended-check" ${att?.attended?'checked':''} onchange="saveAttendance('${sessionId}','${b.shopify_order_name}',${jsArg((existing?.child_name||''))},this.checked)"></td>
        <td>${editInput('scn-'+cid,existing?.child_name||'','Child name')}</td><td>${editInput('sca-'+cid,existing?.child_age||'','Age','short')}</td>
        <td>${editCheck('swh-'+cid,existing?.walk_home||false)}</td><td>${editInput('smn-'+cid,existing?.medical||'','Medical notes')}</td>
        <td>${editInput('spp-'+cid,existing?.parent_phone||'','Phone')}</td>
        <td>${editInput('sec-'+cid,existing?.emergency_contact||'','Emergency contact')}</td>
        <td style="color:#888">${escText(b.customer_name) || '&mdash;'}${bookingCountBadge(b)}</td><td style="text-align:center"></td>
        <td style="color:#888">${shopifyOrderLink(b.shopify_order_name)}</td><td></td>
        <td class="no-print"><button class="row-save-btn" onclick="saveChildRow('${existing?.id||null}','${b.id}',${childIndex},'${cid}','sc')">Save</button>${cuC.html}</td>
      </tr>` })
    }
  })
  const sortBtn = col => `<button class="series-sort-btn no-print" data-col="${col}" onclick="sortSeriesTable('${col}')" style="background:none;border:none;cursor:pointer;font-size:10px;color:#888;padding:0;margin-left:2px;opacity:0.3"> ⇅</button>`
  const incomingRowsHtml = buildCatchupIncomingRows(incomingCatchups)
  return `<table class="booking-table"><thead><tr><th>✓</th><th>Participant${sortBtn('name')}</th><th>Age / DOB${sortBtn('age')}</th><th>Walk home?</th><th>Medical</th><th>Parent phone</th><th>Emergency contact</th><th>Registered by${sortBtn('registeredBy')}</th><th style="text-align:center">Qty</th><th>Order</th><th>Notes</th><th class="no-print"></th></tr></thead><tbody id="series-table-body">${seriesTableRows.map(r=>r.html).join('')}${incomingRowsHtml}</tbody></table>`
}

async function saveSeriesRow(tallyId, orderName, uid, sessionId, studioId, sessionTime) {
  const btn = document.querySelector(`button[onclick="saveSeriesRow('${tallyId}','${orderName}','${uid}','${sessionId}','${studioId}','${sessionTime}')"]`)
  const camper_name = document.getElementById(`scn-${uid}`)?.value?.trim()
  if (!camper_name) { alert('Please enter a child name'); return }
  const ecRaw = document.getElementById(`sec-${uid}`)?.value?.trim() || ''
  const ecParts = ecRaw.split(' ')
  const lastPart = ecParts[ecParts.length-1]||''
  const ecPhone = lastPart.match(/[\d\+\-\(\)]{7,}/) ? lastPart : null
  const ecName = ecPhone ? ecParts.slice(0,-1).join(' ') : ecRaw
  const payload = { shopify_order_name: orderName, camper_name, camper_age: document.getElementById(`sca-${uid}`)?.value?.trim()||null, walk_home: document.getElementById(`swh-${uid}`)?.checked||false, medical_notes: document.getElementById(`smn-${uid}`)?.value?.trim()||null, parent_phone: document.getElementById(`spp-${uid}`)?.value?.trim()||null, emergency_contact_name: ecName||null, emergency_contact_phone: ecPhone||null }
  let error
  if (tallyId && tallyId !== 'null') { ;({ error } = await sb.from('tally_registrations').update(payload).eq('id', tallyId)) }
  else { ;({ error } = await sb.from('tally_registrations').insert(payload)) }
  if (error) { alert('Error saving: ' + error.message); return }
  if (btn) {
    btn.textContent = 'Saved ✓'; btn.classList.add('saved')
    if (!tallyId || tallyId === 'null') {
      const { data: newRow } = await sb.from('tally_registrations').select('id').eq('shopify_order_name', orderName).eq('camper_name', camper_name).single()
      if (newRow) btn.setAttribute('onclick', `saveSeriesRow('${newRow.id}','${orderName}','${uid}','${sessionId}','${studioId}','${sessionTime}')`)
    }
    setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved') }, 2000)
  }
}

async function saveAttendance(sessionId, orderName, camperName, attended) {
  const today = dateStr(new Date())
  const { data: existing } = await sb.from('attendance').select('id').eq('session_id', sessionId).eq('shopify_order_name', orderName).eq('camper_name', camperName).single()
  if (existing) { await sb.from('attendance').update({ attended, attended_date: today }).eq('id', existing.id) }
  else { await sb.from('attendance').insert({ session_id: sessionId, shopify_order_name: orderName, camper_name: camperName, attended, attended_date: today }) }
}

async function saveChildRow(existingId, bookingId, childIndex, cid, prefix = 'c') {
  const btn = document.querySelector(`button[onclick*="saveChildRow('${existingId}','${bookingId}',${childIndex},'${cid}')"]`)
  const isSeriesPrefix = cid.includes('-child-') && document.getElementById(`scn-${cid}`) !== null
  const nameId = isSeriesPrefix ? `scn-${cid}` : `cn-${cid}`
  const ageId = isSeriesPrefix ? `sca-${cid}` : `ca-${cid}`
  const whId = isSeriesPrefix ? `swh-${cid}` : `wh-${cid}`
  const mnId = isSeriesPrefix ? `smn-${cid}` : `mn-${cid}`
  const ppId = isSeriesPrefix ? `spp-${cid}` : `pp-${cid}`
  const ecId = isSeriesPrefix ? `sec-${cid}` : `ec-${cid}`
  const payload = { booking_id: bookingId, child_index: childIndex, child_name: document.getElementById(nameId)?.value?.trim()||null, child_age: document.getElementById(ageId)?.value?.trim()||null, walk_home: document.getElementById(whId)?.checked||false, medical: document.getElementById(mnId)?.value?.trim()||null, parent_phone: document.getElementById(ppId)?.value?.trim()||null, emergency_contact: document.getElementById(ecId)?.value?.trim()||null, notes: null }
  let error
  if (existingId && existingId !== 'null') { ;({ error } = await sb.from('booking_children').update(payload).eq('id', existingId)) }
  else {
    const { data: inserted, error: insertError } = await sb.from('booking_children').insert(payload).select().single()
    error = insertError
    if (inserted && btn) {
      const currentOnclick = btn.getAttribute('onclick') || ''
      const hasPrefix = currentOnclick.includes(",'sc'")
      btn.setAttribute('onclick', `saveChildRow('${inserted.id}','${bookingId}',${childIndex},'${cid}'${hasPrefix?",'sc'":''})`)}
  }
  if (error) { alert('Error saving: ' + error.message); return }
  if (btn) { btn.textContent = 'Saved ✓'; btn.classList.add('saved'); setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved') }, 2000) }
}

// ── Day view prints, copied as-is: extras (hot chocolate & candy) and all glazing.
//    planPrintExtras / planPrintGlazing set currentStudioId and currentDate first.
var currentDate = new Date();
function fmtTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  const ampm = h < 12 ? 'am' : 'pm'
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2,'0')}${ampm}`
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatDate(d) {
  return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

async function printAllGlazing() {
  const today = dateStr(currentDate)
  const { data: sessions } = await sb.from('sessions')
    .select('*').eq('studio_id', currentStudioId).eq('session_date', today).eq('session_type', 'glazing').order('session_time')
  if (!sessions || !sessions.length) { alert('No glazing sessions found today.'); return }

  const allBookings = {}
  for (const s of sessions) {
    const { data: bookings } = await sb.from('bookings')
      .select('id, customer_name, customer_email, customer_phone, qty, shopify_order_name, booked_at, raw_payload, event_date, order_note, returned_at, project_preference, reason_for_gathering, hot_chocolate_qty, candy_bag_qty')
      .eq('session_id', s.id).order('booked_at')
    allBookings[s.id] = bookings || []
  }
  // Hub: the studio's saved glazing pieces (hub_glazing_pieces.sql) win over the order's
  let glzSaved = {}
  try {
    const allIds = Object.values(allBookings).flat().map(b => String(b.id)).filter(Boolean)
    if (allIds.length) { const g = await sb.rpc('hub_glazing_pieces', { p_booking_ids: allIds }); if (!g.error) glzSaved = g.data || {} }
  } catch (e) {}

  // Build print HTML
  const sectionsHtml = sessions.map(s => {
    const bookings = allBookings[s.id] || []
    const active = bookings.filter(b => !b.returned_at && (b.qty || 0) > 0)
    const total = active.reduce((sum, b) => sum + (b.qty || 0), 0)
    const rows = bookings.map(b => {
      const glazing = escText((glzSaved[String(b.id)] != null ? glzSaved[String(b.id)] : getGlazingPiece(b.raw_payload, b.event_date)) || '')   // Hub copy: customer text escaped
      const note = escText(getOrderNote(b) || '')
      const isReturned = !!b.returned_at || (b.qty || 0) === 0
      const rowStyle = isReturned ? 'opacity:0.4;text-decoration:line-through;' : ''
      return `<tr style="${rowStyle}">
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:500">${escText(b.customer_name || '—')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${glazing || '<em style="color:#aaa">not specified</em>'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${isReturned ? '<span style="font-size:11px;color:#c00">returned</span>' : b.qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#888;font-size:12px">${note || ''}</td>
      </tr>`
    }).join('')
    return `<div style="margin-bottom:28px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #333;padding-bottom:4px;margin-bottom:8px">
        <strong style="font-size:15px">${fmtTime(s.session_time)} — ${s.title.replace(/^\*?\d+[:\d]*[ap]m\s+\w+\s+\w+\s*\|\s*/i,'')}</strong>
        <span style="font-size:12px;color:#555">${total} registered</span>
      </div>
      ${bookings.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="padding:4px 8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #ccc">Customer</th>
          <th style="padding:4px 8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #ccc">What they're glazing</th>
          <th style="padding:4px 8px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #ccc">Qty</th>
          <th style="padding:4px 8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #ccc">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<p style="color:#aaa;font-size:13px">No bookings</p>'}
    </div>`
  }).join('')

  const printWin = window.open('', '_blank', 'width=900,height=700')
  printWin.document.write(`<!DOCTYPE html><html><head><title>Glazing Lists — ${today}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;color:#1a1a1a}@media print{@page{size:portrait;margin:1.5cm}}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600;margin:0">Glazing Lists</h2>
      <span style="font-size:13px;color:#888">${today}</span>
    </div>
    ${sectionsHtml}
    <script>window.onload=function(){window.print()}<\/script>
    
<!-- LIGHTBOX -->
<div id="attach-lightbox" onclick="closeLightbox()">
  <button id="attach-lightbox-close" onclick="closeLightbox()">&times;</button>
  <img src="" alt="Attachment">
</div>

</body></html>`)
  printWin.document.close()
}

async function printDayExtras() {
  const today = dateStr(currentDate)
  const { data: sessions } = await sb.from('sessions')
    .select('id, title, session_time').eq('studio_id', currentStudioId).eq('session_date', today).order('session_time')

  const ids = (sessions || []).map(s => s.id)
  const { data: bookings } = ids.length
    ? await sb.from('bookings')
        .select('session_id, qty, hot_chocolate_qty, candy_bag_qty')
        .in('session_id', ids).gt('qty', 0).is('returned_at', null)
    : { data: [] }

  const hotChocBySession = {}, candyBySession = {}
  let totalHotChoc = 0, totalCandy = 0
  ;(bookings || []).forEach(b => {
    if (b.hot_chocolate_qty) {
      hotChocBySession[b.session_id] = (hotChocBySession[b.session_id] || 0) + b.hot_chocolate_qty
      totalHotChoc += b.hot_chocolate_qty
    }
    if (b.candy_bag_qty) {
      candyBySession[b.session_id] = (candyBySession[b.session_id] || 0) + b.candy_bag_qty
      totalCandy += b.candy_bag_qty
    }
  })

  const dateLabel = formatDate(currentDate)

  if (!totalHotChoc && !totalCandy) {
    alert('No hot chocolate or candy bag orders found for today.')
    return
  }

  const rows = (sessions || [])
    .filter(s => hotChocBySession[s.id] || candyBySession[s.id])
    .map(s => `<tr>
      <td class="time">${fmtTime(s.session_time)}</td>
      <td class="name">${escText(s.title || '—')}</td>
      <td class="center">${hotChocBySession[s.id] || '—'}</td>
      <td class="center">${candyBySession[s.id] || '—'}</td>
    </tr>`).join('')

  const printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Hot Chocolate &amp; Candy — ${dateLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
  h1 { font-size: 17px; font-weight: 600; margin-bottom: 3px; }
  .subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
  .totals { display: flex; gap: 24px; margin-bottom: 22px; }
  .total-card { border: 1px solid #e0e0d8; border-radius: 8px; padding: 10px 18px; }
  .total-value { font-size: 20px; font-weight: 700; }
  .total-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 5px 8px; font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1.5px solid #1a1a1a; font-weight: 500; }
  th.center, td.center { text-align: center; }
  td { padding: 6px 8px; border-bottom: 0.5px solid #f0f0e8; }
  td.time { font-weight: 600; white-space: nowrap; }
  @page { size: portrait; }
  @media print { body { padding: 12px; } }
</style></head><body>
  <h1>Hot Chocolate &amp; Candy — ${dateLabel}</h1>
  <div class="subtitle">${currentStudioId}</div>
  <div class="totals">
    <div class="total-card"><div class="total-value">☕ ${totalHotChoc}</div><div class="total-label">Hot Chocolate</div></div>
    <div class="total-card"><div class="total-value">🍬 ${totalCandy}</div><div class="total-label">Candy Bags</div></div>
  </div>
  <table><thead><tr><th>Time</th><th>Session</th><th class="center">☕ Hot Choc</th><th class="center">🍬 Candy</th></tr></thead>
  <tbody>${rows}</tbody></table>
</body></html>`

  const win = window.open('', '_blank', 'width=600,height=800')
  win.document.write(printHtml)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

function getGlazingPiece(rawPayload, sessionDate) {
  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    if (!payload?.line_items) return null
    const items = payload.line_items
    let match = items.find(li => {
      const t = (li.title || li.name || '').toLowerCase()
      if (sessionDate) {
        const d = new Date(sessionDate + 'T12:00:00')
        const monthDay = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).replace('.', '').toLowerCase()
        if (t.includes(monthDay)) return true
      }
      return false
    })
    if (!match) match = items[0]
    const props = match?.properties || []
    return props.find(p => p.name?.toLowerCase().includes('glazing'))?.value || null
  } catch(e) { return null }
}

function getOrderNote(booking) {
  if (booking.order_note) return booking.order_note
  try {
    const p = typeof booking.raw_payload === 'string' ? JSON.parse(booking.raw_payload) : booking.raw_payload
    return p?.note || ''
  } catch { return '' }
}

// ── Hub additions to the gift card (credit for overpaid parties):
//  • as soon as the gift card is sent, it's written to the party's details
//    (outcome "Issue credit", the amount, and the note), so it's on record even
//    if nobody presses Save afterwards;
//  • once a gift card has been sent for a party, the calculator shows
//    "already sent" instead of the button, so it can't be sent twice.
(function () {
  const originalIssue = issueGiftCard;
  issueGiftCard = async function (uid, email, name, amount) {
    const btn = document.getElementById(`gc-btn-${uid}`);
    const holder = btn && btn.closest('[id^="card-party-"]');
    const bookingId = holder ? holder.id.replace('card-party-', '') : null;
    if (bookingId) {
      const { data: pd } = await sb.from('party_details').select('outcome, outcome_notes').eq('booking_id', bookingId).maybeSingle();
      if (pd && /gift card sent/i.test(pd.outcome_notes || '')) {
        alert('A gift card has already been sent for this party:\n\n' + pd.outcome_notes);
        return;
      }
    }
    await originalIssue.apply(this, arguments);
    if (!btn || !bookingId || !/gift card sent/i.test(btn.textContent)) return;
    const notes = (document.getElementById(`${uid}-outcome_notes`) || {}).value || `Gift card sent to ${email}`;
    const now = new Date().toISOString();
    const patch = { outcome: 'Issue credit', outcome_amount: Number(amount).toFixed(2), outcome_notes: notes, updated_at: now };
    const { data: ex } = await sb.from('party_details').select('booking_id').eq('booking_id', bookingId).maybeSingle();
    let sessionId = null;   // party_details.session_id is required for a new row
    if (!ex) { const { data: bk } = await sb.from('bookings').select('session_id').eq('id', bookingId).maybeSingle(); sessionId = bk && bk.session_id; }
    const r = ex ? await sb.from('party_details').update(patch).eq('booking_id', bookingId)
                 : await sb.from('party_details').insert(Object.assign({ booking_id: bookingId, session_id: sessionId, studio_id: _sessionStudioId }, patch));
    if (r.error) alert('The gift card was sent, but saving that to the party didn’t work: ' + r.error.message + '\nPress Save on the form to record it.');
  };
  const originalRecalc = recalcOutcome;
  recalcOutcome = function (uid) {
    originalRecalc.apply(this, arguments);
    const notesEl = document.getElementById(`${uid}-outcome_notes`);
    const btn = document.getElementById(`gc-btn-${uid}`);
    if (btn && notesEl && /gift card sent/i.test(notesEl.value || '')) {
      btn.disabled = true; btn.style.background = '#2e7d32';
      btn.textContent = '✓ Gift card already sent — ' + notesEl.value.replace(/^gift card sent to /i, '');
    }
  };
})();

// After a save on the Schedule: refresh the day's numbers (guests, closed / contacted).
(function () {
  const original = savePartyDetail;
  savePartyDetail = async function (bookingId) {
    await original.apply(this, arguments);
    const fresh = await sb.from('party_details').select('*').eq('booking_id', bookingId).maybeSingle();
    if (!fresh.data) return;
    if (typeof _plan !== 'undefined' && _plan) {
      const pt = _plan.parties.find(x => x.booking_id === bookingId);
      if (pt) { pt.detail = fresh.data; pt.guests = fresh.data.expected_guests || pt.guests; if (paneVisible('plan-pane')) renderPlanDay(); }
    }
    if (typeof _pty !== 'undefined' && _pty) {
      const pt = _pty.list.find(x => x.booking_id === bookingId);
      if (pt) { pt.detail = fresh.data; if (paneVisible('parties-pane')) renderPartiesPane(); }
      refreshCoordBadges();
    }
  };
})();
