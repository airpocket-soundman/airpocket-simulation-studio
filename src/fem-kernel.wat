(module
  (memory (export "memory") 1)
  (func (export "matvec") (param $n i32) (param $nnz i32)
    (param $rows i32) (param $cols i32) (param $vals i32) (param $x i32) (param $y i32)
    (local $i i32) (local $row i32) (local $col i32)
    (local $address i32)
    (memory.fill (local.get $y) (i32.const 0) (i32.mul (local.get $n) (i32.const 8)))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $nnz)))
        (local.set $row (i32.load (i32.add (local.get $rows) (i32.mul (local.get $i) (i32.const 4)))))
        (local.set $col (i32.load (i32.add (local.get $cols) (i32.mul (local.get $i) (i32.const 4)))))
        (local.set $address (i32.add (local.get $y) (i32.mul (local.get $row) (i32.const 8))))
        (f64.store (local.get $address)
          (f64.add (f64.load (local.get $address))
            (f64.mul
              (f64.load (i32.add (local.get $vals) (i32.mul (local.get $i) (i32.const 8))))
              (f64.load (i32.add (local.get $x) (i32.mul (local.get $col) (i32.const 8)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next))))
)
