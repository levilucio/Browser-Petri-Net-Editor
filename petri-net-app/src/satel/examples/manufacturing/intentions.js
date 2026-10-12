/**
 * Manufacturing Workflow Test Intentions - Fixed for Reachable Transitions
 * 
 * Only uses transitions that actually fire: receiveOrder, startCutting, passQualityCheck, failQualityCheck
 * Maintains meaningful manufacturing scenarios within the reachable state space.
 */

export const manufacturingIntentionsQuick = [
  {
    id: 'receive-order-simple',
    name: 'Receive Order - Simple',
    description: 'Order is received into the system',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    oracleType: 'positive'
  },
  
  {
    id: 'receive-and-cut',
    name: 'Receive and Start Cutting',
    description: 'Order received and cutting phase begins',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    oracleType: 'positive'
  },
  
  {
    id: 'quality-pass',
    name: 'Quality Check - Pass',
    description: 'Product passes quality inspection',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    oracleType: 'positive'
  },
  
  {
    id: 'quality-fail',
    name: 'Quality Check - Fail',
    description: 'Product fails quality inspection',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    oracleType: 'positive'
  },
  
  {
    id: 'quality-rework',
    name: 'Quality Fail then Pass (Rework)',
    description: 'Product fails QC, is reworked, then passes',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' },
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    oracleType: 'positive'
  }
];

export const manufacturingIntentions = [
  // ========== BASIC WORKFLOW ==========
  {
    id: 'receive-order-only',
    name: 'Receive Order Only',
    description: 'Order enters the system',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'order_intake',
      reason: 'All orders start here'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'order-to-cutting',
    name: 'Order → Cutting',
    description: 'Order received and moves to cutting phase',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'order_processing',
      representative: 'basic_flow',
      reason: 'Standard path for all orders'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'multiple-orders',
    name: 'Multiple Cut Operations',
    description: 'Multiple cutting operations in sequence',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'startCutting' },
        { transition: 'startCutting' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'batch_processing',
      reason: 'Test sequential operations'
    },
    oracleType: 'positive'
  },
  
  // ========== QUALITY CONTROL - PASS ==========
  {
    id: 'successful-production',
    name: 'Successful Production (QC Pass)',
    description: 'Complete happy path: order → cut → pass QC',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'happy_path',
      representative: 'standard_success',
      reason: 'Most common successful flow'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'direct-pass',
    name: 'Direct Quality Pass',
    description: 'Product passes quality check first time',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'quality_outcomes',
      reason: 'QC pass is a terminal positive outcome'
    },
    oracleType: 'positive'
  },
  
  // ========== QUALITY CONTROL - FAIL ==========
  {
    id: 'quality-failure',
    name: 'Quality Failure',
    description: 'Product fails quality inspection',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'quality_failures',
      representative: 'first_failure',
      reason: 'Initial QC rejection path'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'direct-fail',
    name: 'Direct Quality Fail',
    description: 'Product fails quality check',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'failQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'quality_outcomes',
      reason: 'QC fail is a terminal negative outcome'
    },
    oracleType: 'positive'
  },
  
  // ========== REWORK SCENARIOS ==========
  {
    id: 'rework-once-success',
    name: 'Rework Once → Success',
    description: 'Fail QC, rework (cut again), then pass',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' },
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'rework_attempts',
      reason: 'Test single rework iteration'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'rework-twice-success',
    name: 'Rework Twice → Success',
    description: 'Fail QC twice, succeed on third attempt',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' },
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' },
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'rework_attempts',
      reason: 'Test double rework iteration'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'repeated-failures',
    name: 'Repeated Quality Failures',
    description: 'Multiple consecutive QC failures',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'failQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'failure_patterns',
      reason: 'Test cascading failures'
    },
    oracleType: 'positive'
  },
  
  // ========== EDGE CASES ==========
  {
    id: 'alternating-outcomes',
    name: 'Alternating Pass/Fail',
    description: 'Quality checks alternate between pass and fail',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'quality_patterns',
      reason: 'Test mixed outcomes'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'cutting-burst',
    name: 'Burst Cutting',
    description: 'Multiple cutting operations in quick succession',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder' },
        { transition: 'startCutting' },
        { transition: 'startCutting' },
        { transition: 'startCutting' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'production_rate',
      reason: 'Test rapid production'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'long-workflow',
    name: 'Extended Workflow',
    description: 'Production sequence with multiple quality checks',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'startCutting' },
        { transition: 'failQualityCheck' },
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'workflow_length',
      reason: 'Test multi-stage execution paths'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'quality-only',
    name: 'Quality Checks Only',
    description: 'Focus on quality control without order intake',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'passQualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'quality_subsystem',
      reason: 'Test QC subsystem in isolation'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'minimal-path',
    name: 'Minimal Production Path',
    description: 'Shortest possible successful path',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'startCutting' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'minimal_workflows',
      reason: 'Shortest successful production'
    },
    oracleType: 'positive'
  }
];

export const manufacturingIntentionsDescription = `
# Manufacturing System Test Intentions (Fixed for Reachable Transitions)

Updated to use only transitions that fire in the reachability graph:
- receiveOrder
- startCutting
- passQualityCheck
- failQualityCheck

## Test Categories

### 1. Basic Workflow (3 tests)
- Single order intake
- Order → Cutting transition
- Multiple order batching

### 2. Quality Control - Pass (2 tests)
- Successful production flow
- Direct quality pass

### 3. Quality Control - Fail (2 tests)
- Quality failure detection
- Direct quality fail

### 4. Rework Scenarios (3 tests)
- Single rework iteration
- Double rework iteration
- Repeated failures

### 5. Edge Cases (5 tests)
- Alternating pass/fail outcomes
- Burst cutting operations
- Extended multi-stage workflow
- Quality subsystem isolation
- Minimal successful path

## Total: 15 Test Intentions
All intentions use only reachable transitions to ensure test case generation succeeds.
`;
