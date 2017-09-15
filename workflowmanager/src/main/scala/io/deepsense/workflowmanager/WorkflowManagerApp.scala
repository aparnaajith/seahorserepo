/**
 * Copyright (c) 2015, CodiLime Inc.
 */

package io.deepsense.workflowmanager

import akka.actor.ActorSystem
import com.google.inject.{Guice, Stage}

import io.deepsense.commons.rest.RestServer
import io.deepsense.commons.utils.Logging
import io.deepsense.deeplang.CatalogRecorder
import io.deepsense.deeplang.catalogs.doperable.DOperableCatalog
import io.deepsense.deeplang.catalogs.doperations.DOperationsCatalog

/**
 * This is the entry point of the Workflow Manager application.
 */
object WorkflowManagerApp extends App with Logging {
  val insecure: Boolean = args.headOption.map("insecure".equalsIgnoreCase).getOrElse(true)

  try {
    val injector = Guice.createInjector(Stage.PRODUCTION, new WorkflowManagerAppModule(insecure))
    CatalogRecorder.registerDOperables(injector.getInstance(classOf[DOperableCatalog]))
    CatalogRecorder.registerDOperations(injector.getInstance(classOf[DOperationsCatalog]))
    injector.getInstance(classOf[RestServer]).start()
    injector.getInstance(classOf[ActorSystem]).awaitTermination()
  } catch {
    case e: Exception =>
      logger.error("Application context creation failed", e)
      System.exit(1)
  }
}
