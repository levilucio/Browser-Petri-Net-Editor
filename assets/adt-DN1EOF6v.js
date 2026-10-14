const e=`
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
`;function o(r,t="Normal"){return{__adt__:!0,constructor:"Order",args:[r,typeof t=="string"?{__adt__:!0,constructor:t,args:[]}:t]}}function n(r){return{__adt__:!0,constructor:"Material",args:[r]}}function c(r,t){return{__adt__:!0,constructor:"Job",args:[r,t]}}function u(r,t="Pass"){return{__adt__:!0,constructor:"Product",args:[r,typeof t=="string"?{__adt__:!0,constructor:t,args:[]}:t]}}export{u as a,c as b,n as c,o as d,e as m};
//# sourceMappingURL=adt-DN1EOF6v.js.map
