(module
  (memory 1)
  (func
    (result
      i32
    )
    memory.grow 0
    i32.const 0
    i32.store 0 name
    f64.const 30
    i32.store 1 age
  )
  (export "main" (func 0))
)