/**
 * Result ADT Definition
 * 
 * Result<T, E> = Ok(value: T) | Err(error: E)
 */

export const resultADT = `<?xml version="1.0"?>
<algebraicDataTypes>
  <type name="Result">
    <constructor name="Ok" arity="1" result="Result">
      <param index="0" type="Any"/>
    </constructor>
    <constructor name="Err" arity="1" result="Result">
      <param index="0" type="String"/>
    </constructor>
    <operation name="isOk" arity="1" result="Bool">
      <param index="0" type="Result"/>
    </operation>
    <operation name="isErr" arity="1" result="Bool">
      <param index="0" type="Result"/>
    </operation>
    <operation name="unwrap" arity="1" result="Any">
      <param index="0" type="Result"/>
    </operation>
    <operation name="unwrapErr" arity="1" result="String">
      <param index="0" type="Result"/>
    </operation>
    <axioms>
      <axiom name="ok_is_ok">isOk(Ok(x)) = true</axiom>
      <axiom name="err_is_err">isErr(Err(e)) = true</axiom>
      <axiom name="ok_not_err">isOk(Ok(x)) = not(isErr(Ok(x)))</axiom>
      <axiom name="unwrap_ok">unwrap(Ok(x)) = x</axiom>
      <axiom name="unwrap_err">unwrapErr(Err(e)) = e</axiom>
    </axioms>
  </type>
</algebraicDataTypes>`;
