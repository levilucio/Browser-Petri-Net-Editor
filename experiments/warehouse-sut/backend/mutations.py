"""Explicit research faults. Imported only by mutation_server.py, never app.py."""
MUTANTS=['none','pair-max-demand','tenant-read-leak','cancel-reservation-leak','return-double-credit','transfer-loss','refusal-audit-write','late-release-audit']
def install(app,name):
    if name not in MUTANTS:raise ValueError('Unknown mutation')
    original=app.perform
    def perform(c,actor,method,d):
        app.typed(method,d)
        if name=='tenant-read-leak' and method=='readOrder':
            o=app.row(c,'orders','id',d['order']);actor={**actor,'tenant':o['tenant']}
        if name=='pair-max-demand' and method=='reservePair':
            # Fault: two requests for the same SKU are combined with max, not sum.
            try:
                o=app.row(c,'orders','id',d['order']);l=app.row(c,'lines','id',d['line']);m=app.row(c,'lines','id',d['line2']);w=app.row(c,'warehouses','id',d['warehouse'])
                app.require(actor['role']==3 and actor['tenant']==o['tenant'] and o['state']==3 and w['opened'])
                app.require(l['id']!=m['id'] and l['order_id']==m['order_id']==o['id'] and l['warehouse']==m['warehouse']==w['id'] and l['product']==m['product'])
                for line,q in [(l,d['quantity']),(m,d['quantity2'])]:app.require(line['state']==1 and 1<=q<=line['quantity']-line['shipped']-line['reserved'] and app.row(c,'products','id',line['product'])['active'])
                s=app.stock(c,l['product'],w['id']);amount=max(d['quantity'],d['quantity2']);app.require(s['on_hand']-s['reserved']>=amount)
            except app.Refusal:pass
            else:
                for line,q in [(l,d['quantity']),(m,d['quantity2'])]:app.update(c,'lines','id',line['id'],reserved=line['reserved']+q)
                app.reserve(c,l['product'],w['id'],amount);app.audit(c,actor,o['id'],method,d);return {}
        before=None
        if name in ['cancel-reservation-leak','return-double-credit'] and method in ['cancelLine','returnLine']:
            before=app.row(c,'lines','id',d['line'])
        try:result=original(c,actor,method,d)
        except app.Refusal:
            if name=='refusal-audit-write' and d.get('order') is not None and c.execute('SELECT 1 FROM orders WHERE id=?',(d['order'],)).fetchone():
                app.audit(c,actor,d['order'],'seeded-refusal-write',d);c.commit()
            raise
        if name=='cancel-reservation-leak' and method=='cancelLine':app.reserve(c,before['product'],before['warehouse'],before['reserved'])
        if name=='return-double-credit' and method=='returnLine':app.move(c,before['product'],before['warehouse'],d['quantity'],'seeded-double-return',d['order'])
        if name=='transfer-loss' and method=='transferStock':app.move(c,d['product'],d['destination'],-d['quantity'],'seeded-transfer-loss')
        if name=='late-release-audit' and method=='releaseLine':
            count=c.execute("SELECT COUNT(*) FROM audit WHERE order_id=? AND action='releaseLine'",(d['order'],)).fetchone()[0]
            if count>=10:app.audit(c,actor,d['order'],'seeded-late-release',d)
        return result
    app.perform=perform
