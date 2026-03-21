rm isolate*
npx tsx --prof benchmarks/scripts/benchmark.ts

for file in ./isolate*; do
    node --prof-process "$file" >"$file.profiled"
done
