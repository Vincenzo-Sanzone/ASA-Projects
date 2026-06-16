(define (domain delivery-collaboration)
  (:requirements :strips)

  (:predicates
    (at ?a ?x ?y)
    (agent ?a)

    (left ?x1 ?x2)
    (up ?y1 ?y2)
    (wall ?x ?y)
    (crate ?x ?y)
    (can-be-crate ?x ?y)
    (left-tile ?x ?y)
    (right-tile ?x ?y)
    (up-tile ?x ?y)
    (down-tile ?x ?y)

    ;; objectives
    (spawn ?x ?y)
    (delivery ?x ?y)

    ;; per-agent progress
    (reached-spawn ?a)
    (reached-delivery ?a)
    (solved ?a)
  )

  ;; -------------------------
  ;; MOVE
  ;; -------------------------
  (:action move-left
        :parameters (?a ?x1 ?x2 ?y)
        :precondition (and (agent ?a) (at ?a ?x1 ?y) (not (wall ?x2 ?y)) (not (crate ?x2 ?y)) (left ?x2 ?x1) (not (right-tile ?x2 ?y)))
        :effect (and (at ?a ?x2 ?y) (not (at ?a ?x1 ?y)))
    )
    (:action push-left
        :parameters (?a ?x1 ?x2 ?x3 ?y)
        :precondition (and (agent ?a) (at ?a ?x1 ?y) (crate ?x2 ?y) (can-be-crate ?x3 ?y) (not (crate ?x3 ?y)) (left ?x3 ?x2) (left ?x2 ?x1))
        :effect (and (at ?a ?x2 ?y) (not (at ?a ?x1 ?y)) (crate ?x3 ?y) (not (crate ?x2 ?y)))
    )
    (:action move-up
        :parameters (?a ?x ?y1 ?y2)
        :precondition (and (agent ?a) (at ?a ?x ?y1) (not (wall ?x ?y2)) (not (crate ?x ?y2)) (up ?y2 ?y1) (not (down-tile ?x ?y2)))
        :effect (and (at ?a ?x ?y2) (not (at ?a ?x ?y1)))
    )
    (:action push-up
        :parameters (?a ?x ?y1 ?y2 ?y3)
        :precondition (and (agent ?a) (at ?a ?x ?y1) (crate ?x ?y2) (can-be-crate ?x ?y3) (not (crate ?x ?y3)) (up ?y3 ?y2) (up ?y2 ?y1))
        :effect (and (at ?a ?x ?y2) (not (at ?a ?x ?y1)) (crate ?x ?y3) (not (crate ?x ?y2)))
    )
    (:action move-right
        :parameters (?a ?x1 ?x2 ?y)
        :precondition (and (agent ?a) (at ?a ?x1 ?y) (not (wall ?x2 ?y)) (not (crate ?x2 ?y)) (left ?x1 ?x2) (not (left-tile ?x2 ?y)))
        :effect (and (at ?a ?x2 ?y) (not (at ?a ?x1 ?y)))
    )
    (:action push-right
        :parameters (?a ?x1 ?x2 ?x3 ?y)
        :precondition (and (agent ?a) (at ?a ?x1 ?y) (crate ?x2 ?y) (can-be-crate ?x3 ?y) (not (crate ?x3 ?y)) (left ?x1 ?x2) (left ?x2 ?x3))
        :effect (and (at ?a ?x2 ?y) (not (at ?a ?x1 ?y)) (crate ?x3 ?y) (not (crate ?x2 ?y)))
    )
    (:action move-down
        :parameters (?a ?x ?y1 ?y2)
        :precondition (and (agent ?a) (at ?a ?x ?y1) (not (wall ?x ?y2)) (not (crate ?x ?y2)) (up ?y1 ?y2) (not (up-tile ?x ?y2)))
        :effect (and (at ?a ?x ?y2) (not (at ?a ?x ?y1)))
    )
    (:action push-down
        :parameters (?a ?x ?y1 ?y2 ?y3)
        :precondition (and (agent ?a) (at ?a ?x ?y1) (crate ?x ?y2) (can-be-crate ?x ?y3) (not (crate ?x ?y3)) (up ?y1 ?y2) (up ?y2 ?y3))
        :effect (and (at ?a ?x ?y2) (not (at ?a ?x ?y1)) (crate ?x ?y3) (not (crate ?x ?y2)))
    )

  ;; -------------------------
  ;; REACH SPAWN
  ;; -------------------------
  (:action reach-spawn
    :parameters (?a ?x ?y)
    :precondition (and
        (agent ?a)
        (at ?a ?x ?y)
        (spawn ?x ?y)
    )
    :effect (reached-spawn ?a)
  )

  ;; -------------------------
  ;; REACH DELIVERY
  ;; -------------------------
  (:action reach-delivery
    :parameters (?a ?x ?y)
    :precondition (and
        (agent ?a)
        (at ?a ?x ?y)
        (delivery ?x ?y)
    )
    :effect (reached-delivery ?a)
  )

  ;; -------------------------
  ;; COMPLETE TASK
  ;; -------------------------
  (:action complete
    :parameters (?a)
    :precondition (and
        (reached-spawn ?a)
        (reached-delivery ?a)
    )
    :effect (solved ?a)
  )
)