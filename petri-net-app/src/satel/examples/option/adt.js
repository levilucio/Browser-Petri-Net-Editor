/**
 * Option ADT Definition
 * 
 * Option<T> = None | Some(value: T)
 */

export const optionADT = `<?xml version="1.0"?>
<algebraicDataTypes>
  <type name="Option">
    <constructor name="None" arity="0" result="Option"/>
    <constructor name="Some" arity="1" result="Option">
      <param index="0" type="Any"/>
    </constructor>
    <operation name="isSome" arity="1" result="Bool">
      <param index="0" type="Option"/>
    </operation>
    <operation name="isNone" arity="1" result="Bool">
      <param index="0" type="Option"/>
    </operation>
    <operation name="unwrap" arity="1" result="Any">
      <param index="0" type="Option"/>
    </operation>
    <axioms>
      <axiom name="some_is_some">isSome(Some(x)) = true</axiom>
      <axiom name="none_is_none">isNone(None) = true</axiom>
      <axiom name="some_not_none">isSome(Some(x)) = not(isNone(Some(x)))</axiom>
    </axioms>
  </type>
</algebraicDataTypes>`;
