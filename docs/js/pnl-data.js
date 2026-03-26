// ============================================================
//  P&L ACTUALS — Edit this file each month after month close
//  Source: Bright Analytics export
//
//  HOW TO UPDATE:
//  1. Open this file
//  2. Find the month you just closed (e.g. "mar:")
//  3. Replace null with the actual number from Bright Analytics
//  4. Save the file — dashboard updates instantly on reload
//
//  SIGN CONVENTION: costs are NEGATIVE, revenue is POSITIVE
//  PERCENTAGES: enter as plain numbers (e.g. 36.65 not 0.3665)
// ============================================================

window.PNL_ACTUALS = {
  //                     Jan      Feb      Mar      Apr      May      Jun      Jul      Aug      Sep      Oct      Nov      Dec
  turnover:           [ 129481,  133233,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  service_rev:        [  94481,   98233,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  other_rev:          [  35000,   35000,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  people_cost:        [ -77525,  -73180,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  contractor_fees:    [ -72873,  -68372,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  management:         [ -42500,  -42500,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  freelancers:        [ -30373,  -25872,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  payroll:            [  -4652,   -4808,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  wages:              [  -4525,   -4525,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  other_payroll:      [   -127,    -283,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  direct_costs:       [  -4502,   -3667,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  gross_profit:       [  47454,   56386,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  gross_profit_pct:   [  36.65,   42.32,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  ga_expense:         [  -1020,   -1103,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  sm_expense:         [   -414,    -273,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  te_expense:         [  -1632,     -63,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  total_opex:         [  -3065,   -1439,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  reported_ebitda:    [  44389,   54947,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  reported_ebitda_pct:[  34.28,   41.24,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  ebitda_incl_bonus_pct:[34.28,  41.24,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  non_recurring:      [  -5000,   -5000,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  statutory_ebitda:   [  39389,   49947,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  statutory_ebitda_pct:[ 30.42,   37.49,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  depreciation:       [   -337,    -337,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  ebit:               [  39052,   49610,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  ebit_pct:           [  30.16,   37.24,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],

  financial_result:   [    -67,       1,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  ebt:                [  38985,   49611,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  net_result_pct:     [  30.11,   37.24,  null,    null,    null,    null,    null,    null,    null,    null,    null,    null   ]
};


// ============================================================
//  BUDGET — From 260302 Leadstreet Budget 2026.xlsx
//  Only update if the budget itself changes
// ============================================================

window.PNL_BUDGET = {
  //                     Jan      Feb      Mar      Apr      May      Jun      Jul      Aug      Sep      Oct      Nov      Dec
  turnover:           [ 141892,  138036,  148150,  145150,  138093,  127505,  116916,  122448,  141150,  141150,  136093,  136819 ],
  service_rev:        [ 104992,  101136,  111250,  111250,  106193,   95605,   85016,   90548,  111250,  111250,  106193,  106919 ],
  other_rev:          [  36900,   36900,   36900,   33900,   31900,   31900,   31900,   31900,   29900,   29900,   29900,   29900 ],
  commission:         [  35000,   35000,   35000,   32000,   30000,   30000,   30000,   30000,   28000,   28000,   28000,   28000 ],

  people_cost:        [ -80389,  -79496,  -81870,  -81870,  -80683,  -78167,  -75651,  -76979,  -81870,  -81870,  -80683,  -80835 ],
  contractor_fees:    [ -75389,  -74496,  -76870,  -76870,  -75683,  -73167,  -70651,  -71979,  -76870,  -76870,  -75683,  -75835 ],
  management:         [ -42500,  -42500,  -42500,  -42500,  -42500,  -42500,  -42500,  -42500,  -42500,  -42500,  -42500,  -42500 ],
  freelancers:        [ -32889,  -31996,  -34370,  -34370,  -33183,  -30667,  -28151,  -29479,  -34370,  -34370,  -33183,  -33335 ],
  payroll:            [  -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000 ],
  wages:              [  -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -5000 ],
  other_payroll:      [      0,       0,       0,       0,       0,       0,       0,       0,       0,       0,       0,       0 ],

  direct_costs:       [  -4800,   -4800,   -4800,   -4800,   -4800,   -4800,   -4800,   -4800,   -4800,   -4800,   -4800,   -4800 ],

  gross_profit:       [  56703,   53741,   61480,   58480,   52611,   44538,   36466,   40669,   54480,   54480,   50611,   51185 ],
  gross_profit_pct:   [   40.0,    38.9,    41.5,    40.3,    38.1,    34.9,    31.2,    33.2,    38.6,    38.6,    37.2,    37.4 ],

  total_opex:         [  -2606,   -2573,   -2621,   -2621,   -2597,   -5584,   -2571,   -2559,   -2621,   -2621,   -2597,   -2623 ],

  reported_ebitda:    [  54097,   51168,   58859,   55859,   50014,   38954,   33895,   38109,   51859,   51859,   48014,   48562 ],
  reported_ebitda_pct:[   38.1,    37.1,    39.7,    38.5,    36.2,    30.6,    29.0,    31.1,    36.7,    36.7,    35.3,    35.5 ],
  ebitda_incl_bonus_pct:[38.1,    37.1,    39.7,    38.5,    36.2,    30.6,    29.0,    31.1,    36.7,    36.7,    35.3,    35.5 ],

  non_recurring:      [  -5000,   -5000,   -5000,   -5000,   -5000,   -5000,   -3000,   -3000,   -3000,   -3000,   -3000,   -3000 ],
  statutory_ebitda:   [  49097,   46168,   53859,   50859,   45014,   33954,   30895,   35109,   48859,   48859,   45014,   45562 ],
  statutory_ebitda_pct:[ 34.6,    33.4,    36.4,    35.0,    32.6,    26.6,    26.4,    28.7,    34.6,    34.6,    33.1,    33.3 ],

  depreciation:       [  -1200,   -1200,   -1200,   -1200,   -1200,   -1200,   -1200,   -1200,   -1200,   -1200,   -1200,   -1200 ],
  ebit:               [  47897,   44968,   52659,   49659,   43814,   32754,   29695,   33909,   47659,   47659,   43814,   44362 ],
  ebit_pct:           [   33.8,    32.6,    35.5,    34.2,    31.7,    25.7,    25.4,    27.7,    33.8,    33.8,    32.2,    32.4 ],

  financial_result:   [   -100,    -100,    -100,    -100,    -100,    -100,    -100,    -100,    -100,    -100,    -100,    -100 ],
  ebt:                [  47797,   44868,   52559,   49559,   43714,   32654,   29595,   33809,   47559,   47559,   43714,   44262 ],
  net_result_pct:     [   33.7,    32.5,    35.5,    34.1,    31.7,    25.6,    25.3,    27.6,    33.7,    33.7,    32.1,    32.3 ]
};
