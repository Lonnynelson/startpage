'use client';

import { useMemo, useState } from 'react';
import { geoConicConformal, geoConicEqualArea, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import stateTopology from './states-10m.json';
import countyTopology from './counties-10m.json';
import canadaData from './canada.json';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

type Union = { name: string; color: string; conferences: string[] };

const unions: Union[] = [
  { name: 'Atlantic Union', color: '#ee7444', conferences: ['Bermuda Conference', 'Greater New York Conference of SDA', 'New York Conference', 'Northeastern Conference', 'Northern New England Conference', 'Southern New England Conference'] },
  { name: 'Columbia Union', color: '#e7ad3e', conferences: ['Allegheny East Conference', 'Allegheny West Conference', 'Chesapeake Conference', 'Mountain View Conference', 'New Jersey Conference', 'Ohio Conference', 'Pennsylvania Conference', 'Potomac Conference Corporation'] },
  { name: 'Lake Union', color: '#72a66e', conferences: ['Illinois Conference', 'Indiana Conference', 'Lake Region Conference', 'Michigan Conference', 'Wisconsin Conference'] },
  { name: 'Mid-America Union', color: '#4e9da0', conferences: ['Central States Conference', 'Dakota Conference', 'Iowa-Missouri Conference', 'Kansas-Nebraska Conference', 'Minnesota Conference', 'Rocky Mountain Conference'] },
  { name: 'North Pacific Union', color: '#637fb8', conferences: ['Alaska Conference', 'Idaho Conference', 'Montana Conference', 'Oregon Conference', 'Upper Columbia Conference', 'Washington Conference'] },
  { name: 'Pacific Union', color: '#9170b1', conferences: ['Arizona Conference', 'Central California Conference', 'Hawaii Conference', 'Nevada-Utah Conference', 'Northern California Conference', 'Southeastern California Conference', 'Southern California Conference'] },
  { name: 'Southern Union', color: '#cf6579', conferences: ['Carolina Conference', 'Florida Conference', 'Georgia-Cumberland Conference', 'Gulf States Conference', 'Kentucky-Tennessee Conference', 'South Atlantic Conference', 'South Central Conference', 'Southeastern Conference (Florida)'] },
  { name: 'Southwestern Union', color: '#ad754d', conferences: ['Arkansas-Louisiana Conference', 'Oklahoma Conference', 'Southwest Region Conference', 'Texas Conference', 'Texico Conference'] },
  { name: 'SDA Church in Canada', color: '#287d87', conferences: ['Alberta Conference', 'British Columbia Conference', 'Manitoba-Saskatchewan Conference', 'Maritime Conference', 'Newfoundland and Labrador Conference', 'Ontario Conference', 'Quebec Conference'] },
];

const unionStates: Record<string, string[]> = {
  'Atlantic Union': ['BM','CT','MA','ME','NH','NY','RI','VT'], 'Columbia Union': ['DE','MD','NJ','OH','PA','VA','WV'],
  'Lake Union': ['IL','IN','MI','WI'], 'Mid-America Union': ['CO','IA','KS','MN','MO','NE','ND','SD','WY'],
  'North Pacific Union': ['AK','ID','MT','OR','WA'], 'Pacific Union': ['AZ','CA','HI','NV','UT'],
  'Southern Union': ['AL','FL','GA','KY','MS','NC','SC','TN'], 'Southwestern Union': ['AR','LA','NM','OK','TX'],
  'SDA Church in Canada': ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'],
};

const stateAssignments: Record<string, string[]> = {
  AL:['Gulf States Conference','South Central Conference'], AK:['Alaska Conference'], AZ:['Arizona Conference','Nevada-Utah Conference'], AR:['Arkansas-Louisiana Conference','Southwest Region Conference'],
  CA:['Central California Conference','Nevada-Utah Conference','Northern California Conference','Southeastern California Conference','Southern California Conference'], CO:['Central States Conference','Rocky Mountain Conference'], CT:['Northeastern Conference','Southern New England Conference'], DE:['Allegheny East Conference','Chesapeake Conference'],
  FL:['Florida Conference','Gulf States Conference','South Central Conference','Southeastern Conference (Florida)'], GA:['Georgia-Cumberland Conference','South Atlantic Conference','Southeastern Conference (Florida)'], HI:['Hawaii Conference'], ID:['Idaho Conference','Upper Columbia Conference'],
  IL:['Illinois Conference','Lake Region Conference'], IN:['Indiana Conference','Lake Region Conference'], IA:['Central States Conference','Iowa-Missouri Conference'], KS:['Central States Conference','Kansas-Nebraska Conference'],
  KY:['Kentucky-Tennessee Conference','South Central Conference'], LA:['Arkansas-Louisiana Conference','Southwest Region Conference'], ME:['Northeastern Conference','Northern New England Conference'], MD:['Allegheny East Conference','Allegheny West Conference','Chesapeake Conference','Mountain View Conference','Potomac Conference Corporation'],
  MA:['Northeastern Conference','Southern New England Conference'], MI:['Lake Region Conference','Michigan Conference'], MN:['Central States Conference','Lake Region Conference','Minnesota Conference'], MS:['Gulf States Conference','South Central Conference'],
  MO:['Central States Conference','Iowa-Missouri Conference'], MT:['Montana Conference'], NE:['Central States Conference','Kansas-Nebraska Conference'], NV:['Nevada-Utah Conference'], NH:['Northeastern Conference','Northern New England Conference'], NJ:['Allegheny East Conference','New Jersey Conference'],
  NM:['Central States Conference','Rocky Mountain Conference','Southwest Region Conference','Texico Conference'], NY:['Greater New York Conference of SDA','New York Conference','Northeastern Conference'], NC:['Carolina Conference','Georgia-Cumberland Conference','South Atlantic Conference'], ND:['Central States Conference','Dakota Conference'],
  OH:['Allegheny West Conference','Ohio Conference'], OK:['Oklahoma Conference'], OR:['Idaho Conference','Oregon Conference','Upper Columbia Conference'], PA:['Allegheny East Conference','Allegheny West Conference','Pennsylvania Conference'], RI:['Northeastern Conference','Southern New England Conference'],
  SC:['Carolina Conference','South Atlantic Conference'], SD:['Central States Conference','Dakota Conference'], TN:['Georgia-Cumberland Conference','Kentucky-Tennessee Conference','South Central Conference'], TX:['Arkansas-Louisiana Conference','Texas Conference','Texico Conference'],
  UT:['Nevada-Utah Conference'], VT:['Northeastern Conference','Northern New England Conference'], VA:['Potomac Conference Corporation'], WA:['Oregon Conference','Upper Columbia Conference','Washington Conference'], WV:['Allegheny West Conference','Mountain View Conference'], WI:['Lake Region Conference','Wisconsin Conference'], WY:['Central States Conference','Rocky Mountain Conference'],
  BM:['Bermuda Conference'], AB:['Alberta Conference'], BC:['British Columbia Conference'], MB:['Manitoba-Saskatchewan Conference'], NB:['Maritime Conference'], NL:['Newfoundland and Labrador Conference'], NS:['Maritime Conference'], NT:['Alberta Conference'], NU:['Manitoba-Saskatchewan Conference'], ON:['Ontario Conference'], PE:['Maritime Conference'], QC:['Quebec Conference'], SK:['Manitoba-Saskatchewan Conference'], YT:['British Columbia Conference'],
};

type TaxLevel = 'green' | 'yellow' | 'orange' | 'red';
type TaxEntry = { level: TaxLevel; agency: string; url: string; note: string };

const taxLevelMeta: Record<TaxLevel, { color: string; label: string; blurb: string }> = {
  green: { color: '#3f9d6b', label: 'Exempt', blurb: 'Broad exemption for qualifying church purchases, or no statewide sales tax.' },
  yellow: { color: '#e0b13c', label: 'Conditional', blurb: 'Exemption is conditional, restricted, or affected by a different tax system.' },
  orange: { color: '#df8340', label: 'Refund', blurb: 'Tax generally paid first and later refunded.' },
  red: { color: '#cc5561', label: 'Not exempt', blurb: 'No broad exemption for ordinary church operational purchases.' },
};

// Classifications cover ordinary purchases made by a church for church operations only.
const salesTaxExemption: Record<string, TaxEntry> = {
  AL: { level:'red', agency:'Alabama Department of Revenue', url:'https://www.revenue.alabama.gov/faqs/are-churches-exempt-from-sales-and-use-taxes/', note:'Alabama expressly states that churches are not exempt from sales and use tax, except for narrow statutory items or specially named entities.' },
  AK: { level:'green', agency:'Alaska Office of the State Assessor', url:'https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor/AlaskaSalesTaxInformation', note:'Alaska has no statewide sales tax, although municipalities may impose local sales taxes with their own exemption rules.' },
  AZ: { level:'red', agency:'Arizona Department of Revenue', url:'https://azdor.gov/transaction-privilege-tax/non-profit-and-qualifying-healthcare', note:'Arizona provides no general nonprofit exemption from its Transaction Privilege Tax; purchases by nonprofits are normally taxable unless a narrow deduction applies.' },
  AR: { level:'red', agency:'Arkansas tax-exemption report', url:'https://www.dfa.arkansas.gov/wp-content/uploads/SalesTaxExemptionsFY2025.pdf', note:'Arkansas exempts certain sales by churches but does not broadly exempt ordinary purchases made by churches. A limited additional-local-tax rebate may apply to large invoices.' },
  CA: { level:'red', agency:'California Department of Tax and Fee Administration', url:'https://www.cdtfa.ca.gov/industry/nonprofit-organizations/getting-started.htm', note:'California has no general sales-and-use-tax exemption for nonprofit or religious organizations; only specifically authorized transactions qualify.' },
  CO: { level:'green', agency:'Colorado Department of Revenue', url:'https://tax.colorado.gov/sites/tax/files/documents/SUTT_Charitable_Organizations_Feb_2024.pdf', note:'Approved charitable organizations may make direct, mission-related purchases tax-free using organizational funds, subject to documentation requirements.' },
  CT: { level:'green', agency:'Connecticut Department of Revenue Services', url:'https://portal.ct.gov/drs/sales-tax/tax-exemption-programs-for-nonprofit-organizations', note:'Qualifying 501(c)(3) religious or charitable organizations may purchase mission-related supplies, services, and equipment tax-free using CERT-119 and their IRS determination.' },
  DE: { level:'green', agency:'Delaware Division of Revenue', url:'https://revenue.delaware.gov/business-tax-forms/exemption-certificates/', note:'Delaware imposes no state or local sales tax, so it does not issue sales-tax exemption certificates. It instead taxes certain sellers through gross-receipts taxes.' },
  FL: { level:'green', agency:'Florida Department of Revenue', url:'https://floridarevenue.com/taxes/businesses/Pages/nonprofit_sales_tax.aspx', note:'Qualifying religious institutions may receive a Florida Consumer\u2019s Certificate of Exemption for purchases used in their customary nonprofit religious activities.' },
  GA: { level:'red', agency:'Georgia Department of Revenue', url:'https://dor.georgia.gov/taxes/sales-use-tax/tax-exempt-nonprofit-organizations', note:'Georgia grants no general purchase exemption to churches or nonprofits, although narrow exemptions exist for specified organizations and activities.' },
  HI: { level:'yellow', agency:'Hawaii Department of Taxation', url:'https://tax.hawaii.gov/get/', note:'Hawaii uses a vendor-level General Excise Tax rather than a conventional sales tax. Vendors may pass the cost to churches, and nonprofit exemptions generally concern the organization\u2019s own income rather than all purchases.' },
  ID: { level:'red', agency:'Idaho State Tax Commission', url:'https://tax.idaho.gov/taxes/sales-use/stguides-for-certain-groups-2/nonprofits-and-religious-groups/exempt-nonprofits/', note:'Churches must pay tax on ordinary purchases. Limited exemptions cover such things as food for meals sold to members and qualifying food-bank activities.' },
  IL: { level:'green', agency:'Illinois Department of Revenue', url:'https://tax.illinois.gov/questionsandanswers/answer.277.html', note:'Qualifying religious and charitable organizations may obtain an Illinois exemption number beginning with \u201CE99\u201D and use it for eligible organizational purchases.' },
  IN: { level:'green', agency:'Indiana Department of Revenue', url:'https://www.in.gov/dor/files/sib10.pdf', note:'Qualifying religious and charitable nonprofits may obtain state nonprofit status and make mission-related purchases tax-free using the state-issued exemption documentation.' },
  IA: { level:'red', agency:'Iowa Department of Revenue', url:'https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/sales-use-tax-guide/nonprofit-entities', note:'Churches and nonprofits are treated like ordinary purchasers and must pay tax unless a transaction-specific exemption applies. Certain fundraising sales may be exempt.' },
  KS: { level:'green', agency:'Kansas Department of Revenue', url:'https://www.ksrevenue.gov/pub1510.html', note:'A qualifying 501(c)(3) religious organization may purchase property and services used exclusively for religious purposes tax-free after obtaining an exempt-entity certificate.' },
  KY: { level:'green', agency:'Kentucky Department of Revenue', url:'https://revenue.ky.gov/News/Publications/Sales%20Tax%20Newsletters/Sales%20Tax%20Facts%202023%20-%20Dec.pdf', note:'Qualifying 501(c)(3) religious, charitable, and educational organizations may make exempt purchases for their exempt functions using authorization from the Department of Revenue.' },
  LA: { level:'red', agency:'Louisiana Department of Revenue', url:'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/sales-tax/how-do-i-get-a-sales-tax-exempt-number-for-a-non-profit-organization/', note:'Federal nonprofit status does not provide a general Louisiana sales-tax exemption. Only exemptions expressly created by state law apply.' },
  ME: { level:'green', agency:'Maine Revenue Services', url:'https://www1.maine.gov/REVENUE/salesuse/exemptions/exemptions.html', note:'A regularly organized church can apply for a Maine exemption certificate, although federal nonprofit status alone is insufficient.' },
  MD: { level:'green', agency:'Maryland Comptroller', url:'https://www.marylandtaxes.gov/forms/Business_Tax_Tips/bustip6.pdf', note:'Qualifying nonprofit religious organizations may apply for a Maryland Sales and Use Tax Exemption Certificate.' },
  MA: { level:'green', agency:'Massachusetts Department of Revenue', url:'https://www.mass.gov/regulations/830-CMR-64h65-sales-tax-on-meals', note:'Qualifying 501(c)(3) organizations may obtain Form ST-2 and present it with Form ST-5 for purchases used to further their exempt purposes.' },
  MI: { level:'green', agency:'Michigan Department of Treasury', url:'https://www.michigan.gov/taxes/business-taxes/sales-use-tax/information/exemptions-faq', note:'Direct purchases by organized churches or houses of worship are exempt when paid with church funds and not used in a commercial enterprise.' },
  MN: { level:'green', agency:'Minnesota Form ST16 and instructions', url:'https://www.revenue.state.mn.us/sites/default/files/2023-06/st16.pdf', note:'Qualifying nonprofits may apply for Minnesota exempt status and use Form ST3 for eligible purchases, although meals, lodging, and certain other purchases remain taxable.' },
  MS: { level:'red', agency:'Mississippi Department of Revenue', url:'https://dor.ms.gov/business/business-tax-frequently-asked-questions', note:'Churches generally must pay sales tax. Limited exemptions exist for qualifying utilities, religious literature, and specifically named entities.' },
  MO: { level:'green', agency:'Missouri Department of Revenue', url:'https://dor.mo.gov/taxation/business/registration/small-business/maintain/non-profit.html', note:'Religious organizations may apply for a Missouri Sales/Use Tax Exemption Letter for purchases within their religious, charitable, or educational functions.' },
  MT: { level:'green', agency:'Montana Department of Revenue', url:'https://revenue.mt.gov/taxes/general-sales-tax', note:'Montana has no general-use sales tax, although certain resort communities and particular transactions may carry other taxes.' },
  NE: { level:'green', agency:'Nebraska Department of Revenue', url:'https://revenue.nebraska.gov/about/chapter-1-sales-and-use-tax', note:'Organizations created exclusively for religious purposes may receive an exemption certificate and make qualifying organizational purchases tax-free.' },
  NV: { level:'green', agency:'Nevada exemption application', url:'https://tax.nv.gov/wp-content/uploads/2024/03/REV-F005-Application-for-Sales-Use-Tax-Exemption-RCE-1.pdf', note:'Churches and other organizations operated primarily for qualifying religious purposes may apply for a Nevada sales-and-use-tax exemption.' },
  NH: { level:'green', agency:'New Hampshire Department of Revenue Administration', url:'https://www.revenue.nh.gov/faq/does-new-hampshire-have-sales-tax', note:'New Hampshire has no general sales tax on purchased goods.' },
  NJ: { level:'green', agency:'New Jersey Division of Taxation', url:'https://www.nj.gov/treasury/taxation/st5excert.shtml', note:'Qualifying religious organizations may obtain Form ST-5 and use it for purchases directly related to their exempt purposes.' },
  NM: { level:'yellow', agency:'New Mexico Taxation and Revenue Department', url:'https://www.tax.newmexico.gov/businesses/information-for-non-profits/', note:'New Mexico imposes Gross Receipts Tax on sellers. A 501(c)(3) can use a qualifying NTTC for certain tangible-property purchases, but not every purchase or service qualifies.' },
  NY: { level:'green', agency:'New York Department of Taxation and Finance', url:'https://www.tax.ny.gov/bus/st/exempt.htm', note:'Religious and charitable organizations may apply for Form ST-119 and use an exempt-purchase certificate for organizational purchases.' },
  NC: { level:'orange', agency:'North Carolina Department of Revenue', url:'https://www.ncdor.gov/taxes-forms/sales-and-use-tax/other-sales-and-use-tax-resources/nonprofit-sales-and-use-tax-information', note:'Nonprofits normally pay tax when purchasing but qualifying organizations may request semiannual refunds for eligible direct purchases.' },
  ND: { level:'red', agency:'North Dakota Office of State Tax Commissioner', url:'https://www.tax.nd.gov/sales-and-use-tax', note:'Churches are subject to sales tax on ordinary purchases. Bibles, hymnals, prayer books, and religious textbooks are specifically exempt.' },
  OH: { level:'green', agency:'Ohio Revised Code \u00A75739.02', url:'https://codes.ohio.gov/ohio-revised-code/section-5739.02', note:'Purchases of goods and services by churches and qualifying 501(c)(3) charitable organizations are broadly exempt, subject to statutory exclusions.' },
  OK: { level:'green', agency:'Oklahoma Sales Tax Exemption Packet', url:'https://www.oklahoma.gov/content/dam/ok/en/tax/documents/forms/businesses/general/Packet-E.pdf', note:'Direct purchases by an approved church are generally exempt when invoiced to and paid directly by the church. An exemption application is required.' },
  OR: { level:'green', agency:'Oregon Department of Revenue', url:'https://www.oregon.gov/dor/programs/businesses/Pages/sales-tax.aspx', note:'Oregon has no general sales or use tax and therefore does not issue sales-tax exemption certificates.' },
  PA: { level:'green', agency:'Pennsylvania Department of Revenue', url:'https://www.pa.gov/services/revenue/apply-for-non--profit-sales-tax-exemption', note:'Churches and qualifying purely public charities may apply for a sales-tax exemption covering purchases made for their exempt purposes.' },
  RI: { level:'green', agency:'Rhode Island Division of Taxation', url:'https://tax.ri.gov/tax-sections/audit/sales-tax-exempt-organizations', note:'Churches and organizations operated exclusively for religious or charitable purposes may obtain a four-year exemption certificate for qualifying purchases.' },
  SC: { level:'red', agency:'South Carolina Department of Revenue', url:'https://www.dor.sc.gov/sales-use-tax-index/sales-tax-exemptions', note:'Churches and nonprofits must pay tax on property purchased for their own use. The nonprofit exemption principally covers items acquired for resale and certain sales by the organization.' },
  SD: { level:'red', agency:'South Dakota Department of Revenue', url:'https://dor.sd.gov/media/sgxnhnhl/exemptentities.pdf', note:'Churches are not exempt entities and must pay sales tax on ordinary church purchases. Religious schools may qualify separately.' },
  TN: { level:'green', agency:'Tennessee nonprofit tax manual', url:'https://www.tn.gov/content/dam/tn/revenue/documents/tax_manuals/non-profit-organizations.pdf', note:'Approved churches and other qualifying religious, educational, and charitable institutions may purchase property and taxable services for organizational use without sales tax.' },
  TX: { level:'green', agency:'Texas Comptroller', url:'https://comptroller.texas.gov/taxes/exempt/religious.php', note:'Qualifying religious organizations may apply for exemption on purchases related to their exempt purpose using Form AP-209.' },
  UT: { level:'green', agency:'Utah State Tax Commission', url:'https://tax.utah.gov/forms-pubs/pub-25/', note:'Approved 501(c)(3) religious or charitable institutions qualify for exemption, although purchases below $1,000 commonly use a refund procedure unless covered by a contract or utility rule.' },
  VT: { level:'green', agency:'Vermont Department of Taxes', url:'https://tax.vermont.gov/business-and-corp/nonprofits/sales-and-use-tax', note:'Qualifying 501(c)(3) organizations may make eligible purchases tax-free after registering for a Vermont Business Tax Account.' },
  VA: { level:'yellow', agency:'Virginia Tax', url:'https://www.tax.virginia.gov/node/129', note:'Churches can use self-issued Form ST-13A for specified church purchases or apply for a broader nonprofit exemption after meeting Virginia\u2019s qualification requirements.' },
  WA: { level:'red', agency:'Washington Department of Revenue', url:'https://dor.wa.gov/book/export/html/936', note:'Washington provides no blanket nonprofit exemption; churches generally pay sales tax on goods and retail services unless a transaction-specific exemption applies.' },
  WV: { level:'green', agency:'West Virginia Tax Division', url:'https://tax.wv.gov/documents/tsd/tsd320.pdf', note:'Churches and qualifying nonprofit organizations may make exempt purchases when they meet the state\u2019s nonprofit requirements and properly document the exemption.' },
  WI: { level:'green', agency:'Wisconsin Department of Revenue', url:'https://www.revenue.wi.gov/Pages/FAQS/pcs-n-profit.aspx', note:'Churches meeting 501(c)(3) requirements may make exempt purchases, even without an IRS determination letter; Wisconsin organizations generally use a CES number.' },
  WY: { level:'green', agency:'Wyoming sales-tax rules', url:'https://wyoleg.gov/arules/2012/rules/ARR26-007P.pdf', note:'Organizations operated for religious or charitable purposes may receive exemption approval; verified 501(c)(3) organizations can qualify based on that documentation.' },
};

const specialNotes: Record<string,string> = {
  'Central States Conference': 'Includes San Juan County, New Mexico.', 'Rocky Mountain Conference': 'Includes San Juan County, New Mexico.',
  'Georgia-Cumberland Conference': 'Includes Cherokee County, North Carolina.', 'Arkansas-Louisiana Conference': 'Includes Texarkana, Texas.',
  'Bermuda Conference': 'Bermuda is shown in its own map inset.',
};

const fips: Record<string,string> = { '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY' };
const canadaCodes: Record<string,string> = { 'Alberta':'AB','British Columbia':'BC','Manitoba':'MB','New Brunswick':'NB','Newfoundland and Labrador':'NL','Nova Scotia':'NS','Northwest Territories':'NT','Nunavut':'NU','Ontario':'ON','Prince Edward Island':'PE','Quebec':'QC','Saskatchewan':'SK','Yukon Territory':'YT' };
const areaNames: Record<string,string> = { BM:'Bermuda', AB:'Alberta',BC:'British Columbia',MB:'Manitoba',NB:'New Brunswick',NL:'Newfoundland and Labrador',NS:'Nova Scotia',NT:'Northwest Territories',NU:'Nunavut',ON:'Ontario',PE:'Prince Edward Island',QC:'Quebec',SK:'Saskatchewan',YT:'Yukon' };
const countyAssignments: Record<string,string[]> = { '35045':['Central States Conference','Rocky Mountain Conference'], '37039':['Georgia-Cumberland Conference'] };
areaNames['35045'] = 'San Juan County, New Mexico';
areaNames['37039'] = 'Cherokee County, North Carolina';

const topo = stateTopology as unknown as Topology;
const countyTopo = countyTopology as unknown as Topology;
const stateFeatures = (feature(topo, topo.objects.states as GeometryCollection) as unknown as { features: Feature<Geometry>[] }).features;
const countyFeatures = (feature(countyTopo, countyTopo.objects.counties as GeometryCollection) as unknown as { features: Feature<Geometry>[] }).features.filter((geo) => ['35045','37039'].includes(String(geo.id).padStart(5,'0')));
const canadaFeatures = (canadaData as FeatureCollection<Geometry, GeoJsonProperties>).features;
const contiguousStates = stateFeatures.filter((geo) => !['02','15'].includes(String(geo.id).padStart(2,'0')));
const alaskaFeature = stateFeatures.find((geo) => String(geo.id).padStart(2,'0') === '02')!;
const hawaiiFeature = stateFeatures.find((geo) => String(geo.id).padStart(2,'0') === '15')!;
const connectedMap = { type:'FeatureCollection', features:[...canadaFeatures, ...contiguousStates] } as FeatureCollection;
// Fit against explicit North American edge points. Some source polygons use
// incompatible ring winding, which makes D3 see a near-global bounding box and
// compresses the visible geography into roughly one quarter of the SVG.
const northAmericaFrame = { type:'MultiPoint', coordinates:[[-141,60],[-124.7,32],[-66.9,45],[-52.6,48]] } as Geometry;
const connectedProjection = geoConicConformal().parallels([45,65]).rotate([96,0]).fitWidth(940, northAmericaFrame);
const initialBounds = geoPath(connectedProjection).bounds(northAmericaFrame);
const initialTranslate = connectedProjection.translate();
connectedProjection.translate([initialTranslate[0] + 20 - initialBounds[0][0], initialTranslate[1] + 12 - initialBounds[0][1]]);
const makeConnectedPath = geoPath(connectedProjection);
const connectedBounds = makeConnectedPath.bounds(connectedMap);
const insetTop = Math.ceil(connectedBounds[1][1]) + 28;
const mapViewHeight = insetTop + 140;
const alaskaExtent: [[number,number],[number,number]] = [[45, insetTop + 18],[230, insetTop + 118]];
const alaskaProjection = geoConicEqualArea()
  .parallels([55,65])
  .rotate([154,0])
  .center([0,62])
  .fitExtent(alaskaExtent, alaskaFeature)
  .clipExtent(alaskaExtent);
const hawaiiProjection = geoMercator().fitExtent([[260, insetTop + 38],[390, insetTop + 113]], hawaiiFeature);
const makeAlaskaPath = geoPath(alaskaProjection);
const makeHawaiiPath = geoPath(hawaiiProjection);

const partialOnly = new Set(['NM|Central States Conference','NM|Rocky Mountain Conference','NC|Georgia-Cumberland Conference']);
const conferenceStates = Object.fromEntries(unions.flatMap((union) => union.conferences.map((conference) => [conference, Object.entries(stateAssignments).filter(([state, list]) => list.includes(conference) && !partialOnly.has(`${state}|${conference}`)).map(([state]) => state)])));
conferenceStates['Central States Conference'] = ['CO','WY','MN','IA','MO','ND','SD','NE','KS'];
conferenceStates['Rocky Mountain Conference'] = ['CO','WY'];
conferenceStates['Georgia-Cumberland Conference'] = ['GA','TN'];

export default function Home() {
  const [selected, setSelected] = useState('Atlantic Union');
  const [open, setOpen] = useState('Atlantic Union');
  const [focusedArea, setFocusedArea] = useState<string | null>(null);
  const [view, setView] = useState<'territory' | 'tax'>('territory');
  const selectedUnion = unions.find((union) => union.name === selected) ?? unions.find((union) => union.conferences.includes(selected)) ?? unions[0];
  const activeAreaList = unionStates[selected] ?? conferenceStates[selected] ?? [];
  const activeAreas = useMemo(() => new Set(activeAreaList), [activeAreaList]);
  const selectedCountyIds = useMemo(() => new Set(
    selected === 'Mid-America Union' ? ['35045'] :
    selected === 'Central States Conference' || selected === 'Rocky Mountain Conference' ? ['35045'] :
    selected === 'Georgia-Cumberland Conference' ? ['37039'] : []
  ), [selected]);
  const focusedAreaUnions = useMemo(() => {
    if (!focusedArea) return [];
    if (focusedArea === '35045') return ['Mid-America Union'];
    if (focusedArea === '37039') return ['Southern Union'];
    return unions.filter((union) => unionStates[union.name].includes(focusedArea)).map((union) => union.name);
  }, [focusedArea]);
  const focusedTax = focusedArea ? salesTaxExemption[focusedArea] : undefined;
  const taxTotals = useMemo(() => {
    const counts = { green:0, yellow:0, orange:0, red:0 } as Record<TaxLevel, number>;
    for (const entry of Object.values(salesTaxExemption)) counts[entry.level] += 1;
    return counts;
  }, []);

  const areaPaint = (area: string | undefined) => {
    const active = !!area && activeAreas.has(area);
    if (view === 'tax') {
      const tax = area ? salesTaxExemption[area] : undefined;
      return {
        fill: tax ? taxLevelMeta[tax.level].color : '#dce3e1',
        stroke: active ? '#11333d' : '#ffffff',
        strokeWidth: active ? 2.4 : .9,
        opacity: tax ? (active ? 1 : .78) : .3,
      };
    }
    return {
      fill: active ? selectedUnion.color : '#dce3e1',
      stroke: active ? '#173944' : '#ffffff',
      strokeWidth: active ? 1.5 : .9,
      opacity: active ? 1 : .42,
    };
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">LN</span><div><strong>NAD Atlas</strong><small>Conferences &amp; Unions</small></div></div>
        <div className="nav-heading"><span>UNIONS &amp; CONFERENCES</span><span>09</span></div>
        <nav aria-label="Union and conference navigation">
          {unions.map((union) => {
            const expanded = open === union.name;
            return <section className="union-group" key={union.name}>
              <button className={`union-button ${selected === union.name ? 'selected' : ''}`} onClick={() => { setSelected(union.name); setOpen(expanded ? '' : union.name); setFocusedArea(null); }}>
                <span className="dot" style={{ background: union.color }} /><span>{union.name}</span><span className={`chevron ${expanded ? 'up' : ''}`}>⌄</span>
              </button>
              {expanded && <div className="conference-list">{union.conferences.map((conference) => <button className={selected === conference ? 'active' : ''} key={conference} onClick={() => { setSelected(conference); setFocusedArea(null); }}>{conference.replace(' Conference of SDA','').replace(' Conference','').replace(' Corporation','')}</button>)}</div>}
            </section>;
          })}
        </nav>
        <p className="sidebar-note">Select a Union or Conference to reveal its territory. Some conference assignments overlap. In sales-tax view the selection is outlined over the exemption colors.</p>
      </aside>

      <section className="workspace">
        <header><div><p className="eyebrow">INTERACTIVE TERRITORY MAP</p><h1>North American Division</h1><p>Unions, Conferences &amp; Church Sales-Tax Exemption</p></div><button className="help" aria-label="Map guide" title="Choose a union or conference, then click a state, province, territory, or Bermuda for details. Switch to sales-tax view to color states by church purchase exemption.">?</button></header>
        <div className="map-panel">
          <div className="map-toolbar">
            <div><span className="status-dot" style={{background: selectedUnion.color}}/><strong>{selected}</strong><small>{activeAreas.size + selectedCountyIds.size} geographic area{activeAreas.size + selectedCountyIds.size === 1 ? '' : 's'} represented</small></div>
            <div className="view-toggle" role="group" aria-label="Map coloring mode">
              <button className={view === 'territory' ? 'on' : ''} aria-pressed={view === 'territory'} onClick={() => setView('territory')}>Territory</button>
              <button className={view === 'tax' ? 'on' : ''} aria-pressed={view === 'tax'} onClick={() => setView('tax')}>Sales tax</button>
            </div>
          </div>
          <div className="map-stage" aria-label="Interactive map of the United States, Canada, and Bermuda">
            <svg viewBox={`0 0 980 ${mapViewHeight}`} style={{aspectRatio:`980 / ${mapViewHeight}`}} role="img" aria-label={`Connected Canada and contiguous United States map highlighting ${selected}`}>
              {canadaFeatures.map((geo) => {
                const name = String(geo.properties?.name ?? '');
                const area = canadaCodes[name];
                const active = activeAreas.has(area);
                const areaUnion = unions.find((union) => unionStates[union.name].includes(area));
                return <path key={name} d={makeConnectedPath(geo) ?? undefined} onClick={() => setFocusedArea(area)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setFocusedArea(area); }} tabIndex={0} role="button" aria-label={`${name}${active ? `, in ${selected}` : ''}`} {...areaPaint(area)} style={{ '--hover-color': areaUnion?.color ?? '#c5d0ce' } as React.CSSProperties}/>;
              })}
              {contiguousStates.map((geo) => {
                const state = fips[String(geo.id).padStart(2,'0')];
                const active = activeAreas.has(state);
                const stateUnion = unions.find((union) => unionStates[union.name].includes(state));
                return <path key={String(geo.id)} d={makeConnectedPath(geo) ?? undefined} onClick={() => setFocusedArea(state)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setFocusedArea(state); }} tabIndex={0} role="button" aria-label={`${state ?? 'United States territory'}${active ? `, in ${selected}` : ''}`} {...areaPaint(state)} style={{ '--hover-color': stateUnion?.color ?? '#c5d0ce' } as React.CSSProperties}/>;
              })}
              {countyFeatures.map((geo) => {
                const countyId = String(geo.id).padStart(5,'0');
                if (!selectedCountyIds.has(countyId)) return null;
                return <path className="county-highlight" key={countyId} d={makeConnectedPath(geo) ?? undefined} onClick={() => setFocusedArea(countyId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setFocusedArea(countyId); }} tabIndex={0} role="button" aria-label={`${areaNames[countyId]}, in ${selected}`} fill={selectedUnion.color} stroke="#173944" strokeWidth={2.8}/>;
              })}
              <g className="map-inset">
                <rect x="32" y={insetTop} width="215" height="125" rx="10" fill="#ffffff" stroke="#ccd8d6"/>
                <text x="48" y={insetTop + 21}>ALASKA</text>
                <path d={makeAlaskaPath(alaskaFeature) ?? undefined} onClick={() => setFocusedArea('AK')} tabIndex={0} role="button" aria-label={`Alaska${activeAreas.has('AK') ? `, in ${selected}` : ''}`} {...areaPaint('AK')}/>
              </g>
              <g className="map-inset">
                <rect x="255" y={insetTop + 20} width="150" height="105" rx="10" fill="#ffffff" stroke="#ccd8d6"/>
                <text x="271" y={insetTop + 41}>HAWAII</text>
                <path d={makeHawaiiPath(hawaiiFeature) ?? undefined} onClick={() => setFocusedArea('HI')} tabIndex={0} role="button" aria-label={`Hawaii${activeAreas.has('HI') ? `, in ${selected}` : ''}`} {...areaPaint('HI')}/>
              </g>
              <g className="bermuda-inset" role="button" tabIndex={0} aria-label={`Bermuda${activeAreas.has('BM') ? `, in ${selected}` : ''}`} onClick={() => setFocusedArea('BM')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setFocusedArea('BM'); }}>
                <rect x="770" y={insetTop} width="175" height="125" rx="10" fill="#ffffff" stroke="#ccd8d6"/>
                <text x="786" y={insetTop + 21}>BERMUDA</text>
                <defs>
                  <mask id="bermuda-silhouette" maskUnits="userSpaceOnUse" x="790" y={insetTop + 29} width="135" height="91">
                    <image href="/bermuda-mask.png" x="790" y={insetTop + 29} width="135" height="91" preserveAspectRatio="xMidYMid meet"/>
                  </mask>
                </defs>
                <rect x="790" y={insetTop + 29} width="135" height="91" mask="url(#bermuda-silhouette)" fill={view === 'territory' && activeAreas.has('BM') ? selectedUnion.color : '#dce3e1'} opacity={view === 'territory' && activeAreas.has('BM') ? 1 : .5}/>
              </g>
            </svg>
            {focusedArea && <div className="state-card">
              <button aria-label="Close area details" onClick={() => setFocusedArea(null)}>×</button>
              <span>AREA DETAILS</span>
              <strong>{areaNames[focusedArea] ?? focusedArea}</strong>
              <span className="detail-label">CONFERENCES</span>
              <p>{(countyAssignments[focusedArea] ?? stateAssignments[focusedArea])?.join(' · ') ?? 'No conference assignment listed.'}</p>
              <span className="detail-label">UNION</span>
              <p className="union-name">{focusedAreaUnions.join(' · ') || 'No union assignment listed.'}</p>
              <span className="detail-label">CHURCH SALES-TAX EXEMPTION</span>
              {focusedTax
                ? <>
                    <p className="tax-status"><i style={{background: taxLevelMeta[focusedTax.level].color}}/>{taxLevelMeta[focusedTax.level].label}</p>
                    <p>{focusedTax.note}</p>
                    <p><a className="tax-link" href={focusedTax.url} target="_blank" rel="noopener noreferrer">{focusedTax.agency} ↗</a></p>
                  </>
                : <p>No United States sales-tax guidance for this area.</p>}
            </div>}
          </div>
          {view === 'tax'
            ? <footer className="tax-legend">{(Object.keys(taxLevelMeta) as TaxLevel[]).map((level) => <span key={level} title={taxLevelMeta[level].blurb}><i style={{background: taxLevelMeta[level].color}}/>{taxLevelMeta[level].label} · {taxTotals[level]}</span>)}<span className="source">Ordinary church operational purchases only · click a state for the official source</span></footer>
            : <footer><span><i className="legend-selected" style={{background:selectedUnion.color}}/>Selected territory</span><span><i className="legend-overlap"/>Overlapping conferences</span>{specialNotes[selected] && <span className="source">{specialNotes[selected]}</span>}</footer>}
        </div>
      </section>
    </main>
  );
}
