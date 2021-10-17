package main

import (
	"fmt"
	"sync"
)

var (
	COPY_SLICE_ON_READ = false
	CAPACITY_EQUAL_LEN = false
)

func main() {

	asd1 := []int{1, 2, 3, 4, 5}
	asd1 = append(asd1, 1)
	println(cap(asd1))

	m := map[string][]int{}

	// Populate the map with a slice
	capacity := 0
	if CAPACITY_EQUAL_LEN {
		capacity = 3
	}
	asd := make([]int, 0, capacity)
	for i := 1; i < 4; i++ {
		asd = append(asd, i)
	}
	m["asd"] = asd

	fmt.Printf("Original Slice: address: %p, length: %d, capacity: %d, items: %v\n",
		m["asd"], len(m["asd"]), cap(m["asd"]), m["asd"])

	if false {
		m["asd"] = append(m["asd"], []int{5}...)
		printSlice(m["asd"])
		m["asd"] = append(m["asd"], []int{5, 6}...)
		printSlice(m["asd"])
	}

	var results [][]int

	N := 10
	wg := sync.WaitGroup{}
	wg.Add(N)

	for i := 0; i < N; i++ {
		go func(i int) {

			var v []int
			if COPY_SLICE_ON_READ {
				v = make([]int, len(m["asd"]))
				copy(v, m["asd"])
			} else {
				v = m["asd"]
			}

			// Append to the slice
			v = append(v, i)
			printSlice(v)
			wg.Done()

			// Keep track of all the results for analysis of the bug later
			results = append(results, v)

		}(i)
	}
	wg.Wait()

	// Sum up the last elements. Since they go from 0...N the expected results should be n*(n-1) / 2
	sum := 0
	for _, r := range results {
		fmt.Printf("adding %d from %p\n", r[3], r)
		sum += r[3]
	}

	expected := N * (N - 1) / 2

	fmt.Printf("Sum of the last element should be %d, got %d\n", expected, sum)
	if expected == sum {
		fmt.Println("This code works")
	} else {
		fmt.Println("This code has a bug in it!")
	}
	printSlice(m["asd"])
}

func printSlice(s []int) {
	fmt.Printf("Address: %p, length: %d, capacity: %d, items: %v\n", s, len(s), cap(s), s)
}
