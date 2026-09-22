export interface HmShipTodRow {
  id: string;
  floor: string;
  wPlan: string;
  job: string;
  color: string;
  ordQty: number;
  wRecv: number;
  wDeli: number;
  wReady: number;
  ship23: number;
  ship26: number;
  remarks: string;
  isYellowJob?: boolean;
  isRedJob?: boolean;
}

export const INITIAL_HM_SHIP_TOD_DATA: HmShipTodRow[] = [
  { id: '1', floor: '1st.F', wPlan: 'INCTL', job: '111-8415', color: '09-103', ordQty: 30108, wRecv: 27642, wDeli: 27462, wReady: 0, ship23: 30108, ship26: 0, remarks: '', isYellowJob: true },
  { id: '2', floor: '1st.F', wPlan: 'INCTL', job: '111-8415', color: '46-215', ordQty: 14864, wRecv: 16544, wDeli: 16544, wReady: 0, ship23: 14864, ship26: 0, remarks: '', isYellowJob: false },
  { id: '3', floor: '1st.F', wPlan: 'Taj Wash', job: '111-8417', color: '09-103', ordQty: 8742, wRecv: 11141, wDeli: 10001, wReady: 140, ship23: 6900, ship26: 0, remarks: '', isYellowJob: false },
  { id: '4', floor: '1st.F', wPlan: 'INCTL', job: '111-8421', color: '15-103', ordQty: 16224, wRecv: 18344, wDeli: 18194, wReady: 0, ship23: 16585, ship26: 0, remarks: '150 pcs tom at 8pm', isYellowJob: true },
  { id: '5', floor: '1st.F', wPlan: 'INCTL', job: '111-8422', color: '15-103', ordQty: 1468, wRecv: 90, wDeli: 0, wReady: 0, ship23: 1407, ship26: 1450, remarks: '90 pcs tom at 8pm', isYellowJob: true },
  { id: '6', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8442', color: '09-103', ordQty: 533, wRecv: 368, wDeli: 368, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: true },
  { id: '7', floor: '1st.F', wPlan: 'INCTL', job: '111-8458', color: '09-103', ordQty: 6027, wRecv: 5847, wDeli: 5845, wReady: 0, ship23: 4709, ship26: 0, remarks: '', isYellowJob: true },
  { id: '8', floor: '1st.F', wPlan: 'INCTL', job: '111-8458', color: '11-106', ordQty: 5974, wRecv: 5852, wDeli: 5852, wReady: 0, ship23: 4656, ship26: 0, remarks: '', isYellowJob: false },
  { id: '9', floor: '1st.F', wPlan: 'INCTL', job: '111-8479', color: '11-106', ordQty: 1063, wRecv: 1084, wDeli: 1084, wReady: 0, ship23: 0, ship26: 918, remarks: '', isYellowJob: false },
  { id: '10', floor: '2nd.F', wPlan: 'INCTL', job: '111-8486', color: '09-103', ordQty: 1092, wRecv: 404, wDeli: 404, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: true },
  { id: '11', floor: '2nd.F', wPlan: 'INCTL', job: '111-8486', color: '19-114', ordQty: 402, wRecv: 440, wDeli: 440, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: false },
  { id: '12', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8494', color: '09-104', ordQty: 1066, wRecv: 971, wDeli: 969, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: false },
  { id: '13', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8494', color: '15-103', ordQty: 899, wRecv: 951, wDeli: 951, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: true },
  { id: '14', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8495', color: '07-198', ordQty: 716, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 716, remarks: '', isYellowJob: false },
  { id: '15', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8495', color: '09-090', ordQty: 1710, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 1710, remarks: '', isYellowJob: false },
  { id: '16', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8496', color: '07-198', ordQty: 908, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 908, remarks: '', isYellowJob: false },
  { id: '17', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8496', color: '09-090', ordQty: 1137, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 1137, remarks: '', isYellowJob: false },
  { id: '18', floor: '1st.F', wPlan: 'INCTL', job: '111-8500', color: '10-204', ordQty: 14897, wRecv: 11052, wDeli: 10171, wReady: 0, ship23: 0, ship26: 12980, remarks: '881 pcs today at 8pm', isYellowJob: false },
  { id: '19', floor: '2nd.F', wPlan: 'INCTL', job: '111-8501', color: '09-103', ordQty: 1701, wRecv: 1134, wDeli: 1132, wReady: 0, ship23: 1090, ship26: 0, remarks: '', isYellowJob: true },
  { id: '20', floor: '2nd.F', wPlan: 'INCTL', job: '111-8501', color: '17-308', ordQty: 736, wRecv: 745, wDeli: 738, wReady: 0, ship23: 508, ship26: 0, remarks: '', isYellowJob: false },
  { id: '21', floor: '2nd.F', wPlan: 'INCTL', job: '111-8502', color: '09-103', ordQty: 5636, wRecv: 5397, wDeli: 5397, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: true },
  { id: '22', floor: '2nd.F', wPlan: 'INCTL', job: '111-8502', color: '17-308', ordQty: 7401, wRecv: 5242, wDeli: 5206, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: false },
  { id: '23', floor: '2nd.F', wPlan: 'INCTL', job: '111-8503', color: '09-103', ordQty: 161, wRecv: 207, wDeli: 207, wReady: 0, ship23: 161, ship26: 0, remarks: '', isYellowJob: true },
  { id: '24', floor: '2nd.F', wPlan: 'INCTL', job: '111-8504', color: '09-104', ordQty: 1831, wRecv: 1960, wDeli: 1960, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: false },
  { id: '25', floor: '2nd.F', wPlan: 'INCTL', job: '111-8504', color: '43-307', ordQty: 1718, wRecv: 1825, wDeli: 1821, wReady: 0, ship23: 0, ship26: 0, remarks: '', isYellowJob: false },
  { id: '26', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8507', color: '09-104', ordQty: 19912, wRecv: 15530, wDeli: 11130, wReady: 1743, ship23: 5828, ship26: 18618, remarks: '', isRedJob: true },
  { id: '27', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8507', color: '10-204', ordQty: 14318, wRecv: 14007, wDeli: 13207, wReady: 800, ship23: 4706, ship26: 13148, remarks: '', isRedJob: true },
  { id: '28', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8507', color: '75-307', ordQty: 10602, wRecv: 8660, wDeli: 4554, wReady: 700, ship23: 3474, ship26: 9100, remarks: '500 pcs Size tom at 6pm', isRedJob: true },
  { id: '29', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8510', color: '11-106', ordQty: 1134, wRecv: 684, wDeli: 300, wReady: 0, ship23: 234, ship26: 615, remarks: '384 pcs tom at 6pm', isRedJob: true },
  { id: '30', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8510', color: '49-205', ordQty: 4201, wRecv: 3138, wDeli: 1790, wReady: 700, ship23: 868, ship26: 2280, remarks: '', isRedJob: true },
  { id: '31', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8510', color: '73-301', ordQty: 4235, wRecv: 2741, wDeli: 730, wReady: 0, ship23: 875, ship26: 2298, remarks: 'tom at 6pm', isRedJob: true },
  { id: '32', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8513', color: '09-103', ordQty: 750, wRecv: 90, wDeli: 0, wReady: 0, ship23: 0, ship26: 642, remarks: '', isYellowJob: true },
  { id: '33', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8514', color: '35-215', ordQty: 10727, wRecv: 10693, wDeli: 8124, wReady: 150, ship23: 3885, ship26: 9417, remarks: '', isYellowJob: false },
  { id: '34', floor: '1st.F', wPlan: 'INCTL', job: '111-8515', color: '35-215', ordQty: 7192, wRecv: 4880, wDeli: 3593, wReady: 556, ship23: 2359, ship26: 5925, remarks: 'tom at 6pm', isYellowJob: false },
  { id: '35', floor: '1st.F', wPlan: 'INCTL', job: '111-8517', color: '75-307', ordQty: 1206, wRecv: 1069, wDeli: 649, wReady: 0, ship23: 626, ship26: 819, remarks: '', isYellowJob: false },
  { id: '36', floor: '1st.F', wPlan: 'INCTL', job: '111-8518', color: '75-307', ordQty: 8237, wRecv: 6810, wDeli: 3204, wReady: 1039, ship23: 2324, ship26: 6112, remarks: '', isYellowJob: false },
  { id: '37', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8531', color: '09-104', ordQty: 4136, wRecv: 4500, wDeli: 2000, wReady: 1100, ship23: 793, ship26: 1417, remarks: 'tom at 6pm', isRedJob: true },
  { id: '38', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8531', color: '10-204', ordQty: 2215, wRecv: 1439, wDeli: 1420, wReady: 0, ship23: 427, ship26: 773, remarks: '', isRedJob: true },
  { id: '39', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8531', color: '35-215', ordQty: 2207, wRecv: 1806, wDeli: 1636, wReady: 83, ship23: 432, ship26: 765, remarks: '', isRedJob: true },
  { id: '40', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8531', color: '75-307', ordQty: 1965, wRecv: 1981, wDeli: 1981, wReady: 0, ship23: 384, ship26: 731, remarks: '', isRedJob: true },
  { id: '41', floor: '1st.F', wPlan: 'INCTL', job: '111-8532', color: '10-204', ordQty: 2114, wRecv: 1800, wDeli: 420, wReady: 0, ship23: 443, ship26: 646, remarks: '1380 pcs tom at 8pm', isYellowJob: false },
  { id: '42', floor: '1st.F', wPlan: 'INCTL', job: '111-8532', color: '35-215', ordQty: 1121, wRecv: 855, wDeli: 140, wReady: 0, ship23: 255, ship26: 418, remarks: '715 pcs tom at 8pm', isYellowJob: false },
  { id: '43', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8550', color: '09-104', ordQty: 7604, wRecv: 4800, wDeli: 0, wReady: 0, ship23: 0, ship26: 6495, remarks: '', isYellowJob: false },
  { id: '44', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8551', color: '35-215', ordQty: 5444, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 4650, remarks: '', isYellowJob: false },
  { id: '45', floor: 'Gnd.F', wPlan: 'INCTL', job: '111-8552', color: '35-215', ordQty: 275, wRecv: 240, wDeli: 0, wReady: 0, ship23: 0, ship26: 187, remarks: '', isYellowJob: false },
  { id: '46', floor: '2nd.F', wPlan: 'INCTL', job: '111-8553', color: '09-103', ordQty: 7052, wRecv: 1800, wDeli: 66, wReady: 240, ship23: 0, ship26: 5889, remarks: '', isYellowJob: true, isRedJob: true },
  { id: '47', floor: '2nd.F', wPlan: 'INCTL', job: '111-8553', color: '17-308', ordQty: 5331, wRecv: 2400, wDeli: 94, wReady: 62, ship23: 0, ship26: 4493, remarks: '', isRedJob: true },
  { id: '48', floor: '1st.F', wPlan: 'INCTL', job: '111-8555', color: '09-104', ordQty: 9548, wRecv: 2640, wDeli: 0, wReady: 0, ship23: 0, ship26: 8165, remarks: '', isYellowJob: false },
  { id: '49', floor: '2nd.F', wPlan: 'INCTL', job: '111-8556', color: '09-103', ordQty: 640, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 388, remarks: '', isYellowJob: true, isRedJob: true },
  { id: '50', floor: '2nd.F', wPlan: 'INCTL', job: '111-8556', color: '17-308', ordQty: 340, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 232, remarks: '', isRedJob: true },
  { id: '51', floor: '2nd.F', wPlan: 'INCTL', job: '111-8563', color: '09-103', ordQty: 16112, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 791, remarks: '', isYellowJob: true },
  { id: '52', floor: '2nd.F', wPlan: 'INCTL', job: '111-8564', color: '09-103', ordQty: 2878, wRecv: 0, wDeli: 0, wReady: 0, ship23: 0, ship26: 216, remarks: '', isYellowJob: true },
  { id: '53', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8575', color: '09-103', ordQty: 24728, wRecv: 9240, wDeli: 0, wReady: 80, ship23: 0, ship26: 9662, remarks: '', isYellowJob: true, isRedJob: true },
  { id: '54', floor: 'Gnd.F', wPlan: 'Taj Wash', job: '111-8576', color: '09-103', ordQty: 2200, wRecv: 480, wDeli: 0, wReady: 0, ship23: 0, ship26: 436, remarks: '', isYellowJob: true, isRedJob: true },
];

export function calcRowMetrics(row: HmShipTodRow) {
  const wip = Math.max(0, row.wRecv - row.wDeli);
  const target = Math.max(0, wip - row.wReady);
  
  // Wash Target 23-Sep: Ship Qty 23-Sep - TTL. W. Delivery
  const hasTarget23 = row.ship23 > 0 || row.wDeli > 0;
  const target23 = hasTarget23 ? row.ship23 - row.wDeli : 0;

  // Sew RFD 23-Sep: Ship Qty 23-Sep - TTL. W. Received
  const hasRfd23 = row.ship23 > 0 || row.wRecv > 0;
  const rfd23 = hasRfd23 ? row.ship23 - row.wRecv : 0;

  // Wash Target 26-Sep: Ship Qty 26-Sep - TTL. W. Delivery
  const hasTarget26 = row.ship26 > 0 || row.wDeli > 0;
  const target26 = hasTarget26 ? row.ship26 - row.wDeli : 0;

  // Sew RFD 26-Sep: Ship Qty 26-Sep - TTL. W. Received
  const hasRfd26 = row.ship26 > 0 || row.wRecv > 0;
  const rfd26 = hasRfd26 ? row.ship26 - row.wRecv : 0;

  return {
    wip,
    target,
    target23,
    hasTarget23,
    rfd23,
    hasRfd23,
    target26,
    hasTarget26,
    rfd26,
    hasRfd26,
  };
}

export function formatParentheses(val: number): string {
  if (val < 0) {
    return `(${Math.abs(val).toLocaleString()})`;
  }
  return val.toLocaleString();
}
