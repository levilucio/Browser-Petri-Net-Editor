/**
 * Manufacturing ADT Definitions
 * 
 * Algebraic Data Types for the manufacturing workflow:
 * - Order: Production orders with ID and priority
 * - Material: Material with quantity
 * - Priority: Order priority levels
 * - QualityStatus: Quality check outcomes
 */

export const manufacturingADTs = `
<adt-definitions>
  <adt name="Order">
    <constructor name="Order">
      <parameter name="id" type="Nat"/>
      <parameter name="priority" type="Priority"/>
    </constructor>
  </adt>
  
  <adt name="Material">
    <constructor name="Material">
      <parameter name="quantity" type="Nat"/>
    </constructor>
  </adt>
  
  <adt name="Priority">
    <constructor name="Low"/>
    <constructor name="Normal"/>
    <constructor name="High"/>
  </adt>
  
  <adt name="QualityStatus">
    <constructor name="Pass"/>
    <constructor name="Fail"/>
  </adt>
  
  <adt name="Job">
    <constructor name="Job">
      <parameter name="order" type="Order"/>
      <parameter name="material" type="Material"/>
    </constructor>
  </adt>
  
  <adt name="Product">
    <constructor name="Product">
      <parameter name="orderId" type="Nat"/>
      <parameter name="quality" type="QualityStatus"/>
    </constructor>
  </adt>
</adt-definitions>
`;

// Helper functions for creating ADT values
export function createOrder(id, priority = 'Normal') {
  // Priority must be a constructor (High or Normal), not a string
  const priorityAdt = typeof priority === 'string' 
    ? { __adt__: true, constructor: priority, args: [] }
    : priority;
  
  return {
    __adt__: true,
    constructor: 'Order',
    args: [id, priorityAdt]
  };
}

export function createMaterial(quantity) {
  return {
    __adt__: true,
    constructor: 'Material',
    args: [quantity]
  };
}

export function createJob(order, material) {
  return {
    __adt__: true,
    constructor: 'Job',
    args: [order, material]
  };
}

export function createProduct(orderId, quality = 'Pass') {
  // Quality must be a constructor (Pass or Fail), not a string
  const qualityAdt = typeof quality === 'string'
    ? { __adt__: true, constructor: quality, args: [] }
    : quality;
  
  return {
    __adt__: true,
    constructor: 'Product',
    args: [orderId, qualityAdt]
  };
}
